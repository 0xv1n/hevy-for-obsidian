import { Plugin, TFile, TFolder, normalizePath, Notice } from 'obsidian';
import { HevySettingTab, DEFAULT_SETTINGS, HevyPluginSettings } from './settings';
import { fetchWorkouts, fetchWorkoutDetails, HevyWorkout } from './api';
import { formatWeight, sanitizeFileName, convertWeight, calculate1RM, getWeekNumber } from './utils';
import { ExerciseSuggestModal } from './modals';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

// Define an interface for the frontmatter to avoid 'any' errors
interface WorkoutFrontmatter {
    date?: string;
    exercises?: string[];
    hevy_id?: string;
    [key: string]: string | string[] | undefined; 
}

export default class HevyPlugin extends Plugin {
    settings: HevyPluginSettings;

    async onload() {
        await this.loadSettings();
        this.addSettingTab(new HevySettingTab(this.app, this));

        this.addCommand({
            id: 'sync-workouts',
            name: 'Sync workouts',
            callback: async () => { await this.syncWorkouts(); }
        });

        this.addCommand({
            id: 'generate-weekly-report',
            name: 'Generate weekly reports',
            callback: async () => { await this.generateWeeklyReport(); }
        });

        this.addCommand({
            id: 'generate-exercise-stats',
            name: 'Generate exercise stats page',
            callback: () => { this.promptForExerciseStats(); }
        });

        this.addCommand({
            id: 'generate-monthly-review',
            name: 'Generate monthly fitness review',
            callback: async () => { await this.generateMonthlyReview(); }
        });

        this.registerMarkdownCodeBlockProcessor("hevy-table", async (source, el) => {
            const data = await fetchWorkouts(this.settings.apiKey, this.settings.defaultLimit);
            if (!data?.workouts) {
                el.createEl("p", { text: "No workout data found. Check API key." });
                return;
            }

            const table = el.createEl("table");
            const tbody = table.createEl("tbody");
            data.workouts.forEach((w: HevyWorkout) => {
                const row = tbody.createEl("tr");
                const nameCell = row.createEl("td");
                const link = nameCell.createEl("a", { text: w.title, cls: "hevy-link" });
                link.addEventListener("click", (e) => {
                    e.preventDefault();
                    void this.createWorkoutNote(w.id);
                });
                row.createEl("td", { text: new Date(w.start_time).toLocaleDateString() });
            });
        });

        this.registerMarkdownCodeBlockProcessor("hevy-chart", (source, el) => {
            const lines = source.split("\n");
            let exerciseName = "";

            lines.forEach(line => {
                if (line.includes("exercise:")) exerciseName = line.split(":")[1].trim();
            });

            if (!exerciseName) {
                el.createEl("p", { text: "Error: no exercise name specified." });
                return;
            }

            const baseFolder = this.settings.folderPath || "HevyWorkouts";
            const files = this.app.vault.getMarkdownFiles().filter(f => f.path.startsWith(baseFolder));

            const points: { x: string; y: number; rawDate: number }[] = [];
            const frontmatterKey = `1rm-${sanitizeFileName(exerciseName).toLowerCase().replace(/\s+/g, '-')}`;

            files.forEach(file => {
                const cache = this.app.metadataCache.getFileCache(file);
                // Explicitly cast frontmatter to our interface
                const frontmatter = cache?.frontmatter as WorkoutFrontmatter | undefined;

                if (frontmatter && frontmatter[frontmatterKey]) {
                    const dateValue = frontmatter.date || file.basename.split(' - ')[0];
                    const parsedDate = new Date(dateValue);

                    if (!isNaN(parsedDate.getTime())) {
                        const val = frontmatter[frontmatterKey];
                        if (typeof val === 'string') {
                            points.push({
                                x: parsedDate.toLocaleDateString(),
                                y: parseFloat(val),
                                rawDate: parsedDate.getTime()
                            });
                        }
                    }
                }
            });

            points.sort((a, b) => a.rawDate - b.rawDate);

            if (points.length === 0) {
                el.createEl("p", {
                    text: `No local data found for "${exerciseName}". Check frontmatter for '${frontmatterKey}'.`,
                    cls: "hevy-error-msg"
                });
                return;
            }

            const statsEl = el.createDiv({ cls: "hevy-stats-container" });
            const lastVal = points[points.length - 1].y;
            statsEl.createEl("h4", {
                text: `Latest Est. 1RM: ${lastVal.toFixed(1)} ${this.settings.weightUnit}`,
                cls: "hevy-stat-header"
            });

            const canvas = el.createEl("canvas");
            new Chart(canvas, {
                type: 'line',
                data: {
                    labels: points.map(p => p.x),
                    datasets: [{
                        label: `${exerciseName} (1RM Trend)`,
                        data: points.map(p => p.y),
                        borderColor: '#7b68ee',
                        backgroundColor: 'rgba(123, 104, 238, 0.1)',
                        tension: 0.3,
                        fill: true
                    }]
                },
                options: {
                    plugins: { legend: { display: false } },
                    scales: {
                        y: {
                            title: { display: true, text: this.settings.weightUnit },
                            ticks: { precision: 1 }
                        }
                    }
                }
            });
        });
    }

    async ensureFolder(path: string) {
        const normalizedPath = normalizePath(path);
        const folder = this.app.vault.getAbstractFileByPath(normalizedPath);
        if (!folder) await this.app.vault.createFolder(normalizedPath);
    }

    async loadSettings() { 
    const data = (await this.loadData()) as Partial<HevyPluginSettings> | null;
    this.settings = Object.assign({}, DEFAULT_SETTINGS, data); 
}
    
    async saveSettings() { await this.saveData(this.settings); }

    async syncWorkouts() {
        new Notice("Fetching from Hevy.");
        const data = await fetchWorkouts(this.settings.apiKey, this.settings.defaultLimit);
        if (!data?.workouts) return;

        const baseFolder = this.settings.folderPath || "HevyWorkouts";
        await this.ensureFolder(baseFolder);

        for (const w of data.workouts) {
            const dateStr = new Date(w.start_time).toISOString().split('T')[0];
            const fileName = `${dateStr} - ${sanitizeFileName(w.title)}.md`;
            const fullPath = normalizePath(`${baseFolder}/${fileName}`);

            if (!this.app.vault.getAbstractFileByPath(fullPath)) {
                await this.createWorkoutNote(w.id, false);
            }
        }
        new Notice("Sync complete.");
    }

    async generateMonthlyReview() {
        new Notice("Archiving monthly reviews...");
        const baseFolder = this.settings.folderPath || "HevyWorkouts";
        const reportsFolder = `${baseFolder}/MonthlyReports`;
        await this.ensureFolder(reportsFolder);

        const files = this.app.vault.getMarkdownFiles().filter(f => f.path.startsWith(baseFolder) && !f.path.includes("MonthlyReports"));
        const months: Record<string, TFile[]> = {};

        files.forEach(file => {
            const match = file.basename.match(/^\d{4}-\d{2}/);
            if (match) {
                if (!months[match[0]]) months[match[0]] = [];
                months[match[0]].push(file);
            }
        });

        for (const [month, workoutFiles] of Object.entries(months)) {
            const path = normalizePath(`${reportsFolder}/${month}.md`);
            const prs: Record<string, number> = {};

            workoutFiles.forEach(file => {
                const fm = this.app.metadataCache.getFileCache(file)?.frontmatter as WorkoutFrontmatter | undefined;
                if (!fm) return;
                Object.keys(fm).forEach(key => {
                    if (key.startsWith("1rm-")) {
                        const val = fm[key];
                        if (typeof val === 'string') {
                            const numVal = parseFloat(val);
                            const name = key.replace("1rm-", "").replace(/-/g, " ");
                            if (!prs[name] || numVal > prs[name]) prs[name] = numVal;
                        }
                    }
                });
            });

            let content = `# Fitness Review: ${month}\n\n## 🏆 Personal records this month\n| Exercise | Peak 1RM (${this.settings.weightUnit}) |\n| --- | --- |\n`;
            Object.entries(prs).sort().forEach(([name, val]) => {
                content += `| **${name.toUpperCase()}** | ${val.toFixed(1)} |\n`;
            });
            content += `\n## 📅 Sessions\n${workoutFiles.map(f => `- [[${f.basename}]]`).join('\n')}`;

            const existing = this.app.vault.getAbstractFileByPath(path);
            if (existing instanceof TFile) {
                await this.app.fileManager.trashFile(existing);
            }
            await this.app.vault.create(path, content);
        }
        new Notice("Monthly reports archived."); // Fixed casing
    }

    async generateWeeklyReport() {
        const baseFolder = normalizePath(this.settings.folderPath || "HevyWorkouts");
        const folder = this.app.vault.getAbstractFileByPath(baseFolder);

        if (!(folder instanceof TFolder)) return;

        const workoutsByWeek: Record<string, TFile[]> = {};
        for (const file of folder.children) {
            if (file instanceof TFile && file.extension === 'md') {
                const dateMatch = file.name.match(/^\d{4}-\d{2}-\d{2}/);
                if (dateMatch) {
                    const weekStr = getWeekNumber(new Date(dateMatch[0]));
                    if (!workoutsByWeek[weekStr]) workoutsByWeek[weekStr] = [];
                    workoutsByWeek[weekStr].push(file);
                }
            }
        }

        const reportFolder = `${baseFolder}/WeeklyReports`;
        await this.ensureFolder(reportFolder);

        for (const [week, files] of Object.entries(workoutsByWeek)) {
            const reportPath = normalizePath(`${reportFolder}/Report-${week}.md`);
            if (this.app.vault.getAbstractFileByPath(reportPath)) continue;

            let weeklyVolume = 0;
            for (const file of files) {
                const content = await this.app.vault.read(file);
                const lines = content.split('\n');
                lines.forEach(line => {
                    const match = line.match(/\*\*([\d.]+)\s*(kg|lbs)\*\*\s*x\s*(\d+)/);
                    if (match) {
                        let weight = parseFloat(match[1]);
                        const reps = parseInt(match[3]);
                        if (match[2] !== this.settings.weightUnit) {
                            weight = match[2] === 'kg' ? weight * 2.20462 : weight / 2.20462;
                        }
                        weeklyVolume += weight * reps;
                    }
                });
            }

            const reportContent = `# Weekly Report: ${week}\n- Workouts: ${files.length}\n- Volume: ${weeklyVolume.toFixed(1)} ${this.settings.weightUnit}\n\n## Workouts\n${files.map(f => `- [[${f.basename}]]`).join('\n')}`;
            await this.app.vault.create(reportPath, reportContent);
        }
        new Notice("Weekly reports updated.");
    }

    promptForExerciseStats() {
        const baseFolder = normalizePath(this.settings.folderPath || "HevyWorkouts");
        const folder = this.app.vault.getAbstractFileByPath(baseFolder);
        if (!(folder instanceof TFolder)) return;

        const exerciseSet = new Set<string>();
        const files = folder.children.filter((f): f is TFile => f instanceof TFile && f.extension === 'md');

        for (const file of files) {
            const cache = this.app.metadataCache.getFileCache(file);
            const fm = cache?.frontmatter as WorkoutFrontmatter | undefined;
            const fileExercises = fm?.exercises;
            if (Array.isArray(fileExercises)) {
                fileExercises.forEach((ex: string) => exerciseSet.add(ex));
            }
        }

        new ExerciseSuggestModal(this.app, Array.from(exerciseSet).sort(), (selected) => {
            void this.generateExerciseStatPage(selected);
        }).open();
    }

    async generateExerciseStatPage(exerciseName: string) {
        const statsFolder = normalizePath(`${this.settings.folderPath}/ExerciseStats`);
        await this.ensureFolder(statsFolder);
        const fileName = `${statsFolder}/${sanitizeFileName(exerciseName)}.md`;
        const content = `# Stats: ${exerciseName}\n\n## 1RM trend\n\`\`\`hevy-chart\nexercise: ${exerciseName}\n\`\`\``;

        const abstractFile = this.app.vault.getAbstractFileByPath(fileName);
        if (abstractFile instanceof TFile) {
            await this.app.workspace.getLeaf(true).openFile(abstractFile);
        } else {
            const file = await this.app.vault.create(fileName, content);
            await this.app.workspace.getLeaf(true).openFile(file);
        }
    }

    async createWorkoutNote(workoutId: string, open = true) {
        const d = await fetchWorkoutDetails(this.settings.apiKey, workoutId);
        if (!d) return;

        const baseFolder = this.settings.folderPath || "HevyWorkouts";
        await this.ensureFolder(baseFolder);

        const dateStr = new Date(d.start_time).toISOString().split('T')[0];
        const fileName = `${dateStr} - ${sanitizeFileName(d.title)}.md`;
        const fullPath = normalizePath(`${baseFolder}/${fileName}`);

        const exerciseList = d.exercises.map(e => e.title);
        const rmData: Record<string, string> = {};
        d.exercises.forEach(ex => {
            const valid = ex.sets.filter(s => s.weight_kg !== null && s.reps !== null);
            const best1RM = valid.length > 0 ? Math.max(...valid.map(s => calculate1RM(s.weight_kg ?? 0, s.reps ?? 0))) : 0;
            const key = `1rm-${sanitizeFileName(ex.title).toLowerCase().replace(/\s+/g, '-')}`;
            rmData[key] = convertWeight(best1RM, this.settings.weightUnit).toFixed(1);
        });

        const existingFile = this.app.vault.getAbstractFileByPath(fullPath);

        if (existingFile instanceof TFile) {
            await this.app.fileManager.processFrontMatter(existingFile, (fm: WorkoutFrontmatter) => {
                fm.hevy_id = d.id;
                fm.date = d.start_time;
                fm.exercises = exerciseList;
                for (const [key, value] of Object.entries(rmData)) {
                    fm[key] = value;
                }
            });
            if (open) await this.app.workspace.getLeaf(true).openFile(existingFile);
        } else {
            let content = `---\nhevy_id: ${d.id}\ndate: ${d.start_time}\nexercises: ${JSON.stringify(exerciseList)}\n`;
            for (const [key, value] of Object.entries(rmData)) { content += `${key}: ${value}\n`; }
            content += `---\n\n# ${d.title}\n\n`;

            d.exercises.forEach(ex => {
                content += `## ${ex.title}\n`;
                ex.sets.forEach((s, i) => {
                    content += `- Set ${i + 1}: **${formatWeight(s.weight_kg ?? 0, this.settings.weightUnit)}** x ${s.reps}\n`;
                });
                content += `\n`;
            });

            const file = await this.app.vault.create(fullPath, content);
            if (open) await this.app.workspace.getLeaf(true).openFile(file);
        }
    }
}