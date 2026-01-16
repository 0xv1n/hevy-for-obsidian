# 🏋️‍♂️ Hevy for Obsidian

Connect your Hevy workout data directly to your Obsidian second brain. This plugin transforms raw workout logs into actionable insights, automated monthly reports, and dynamic strength dashboards.

## ✨ Key Features

- **Seamless Sync**: Fetch your latest workouts from Hevy and generate beautifully formatted Markdown notes.

- **1RM Tracking**: Automatically calculates and saves Estimated 1-Rep Max (1RM) for every exercise in your note frontmatter.

- **Monthly Archives**: Generate permanent performance reviews in MonthlyReports/ to track long-term progress.

- **Dynamic Dashboards**: Built-in support for Dataview to see your current strength levels and all-time PRs at a glance.

- **Interactive Charts**: View your strength trends over time with custom Chart.js integration inside your notes.
---

## 🚀 Getting Started
1. **Installation**
    - If building: `npm run build`, then copy hevy-for-obsidian to your Obsidian plugins folder.
    - If ***not*** building: copy hevy-for-obsidian to your Obsidian plugins folder. *(the repo will always have the most current build, but I urge you to build it yourself!)*
    - Enable the plugin in Settings > Community Plugins.

2. **Configuration**
    - Go to the Hevy Sync settings tab.
    - Enter your Hevy API Key.
    - Set your preferred Weight Unit (kg/lbs) and the folder where you want your workouts saved.

3. **Usage**
    - Sync: Run the command Sync recent workouts to pull your latest data.
    - Weekly Review: Generate historical weekly reviews for all synced workouts. 
    - Monthly Review: Run Generate Monthly Fitness Review to archive your monthly stats.
    - Stats: Use Generate Exercise Stat Page to create a dedicated note with a progress chart for a specific lift.

## 🖥️ The Strength Dashboard

To see your live progress, you can leverage a plugin like Dataview to create custom and dynamic dashboards. Here is a DataviewJS snippet to help you get started. You must enable JS querying in the Dataview community plugin to utilize it.

```js
const folder = "HevyWorkouts"; 
const pages = dv.pages(`"${folder}"`)
    .where(p => !p.file.path.includes("Reports") && !p.file.path.includes("Stats"));

let exerciseData = {};

pages.forEach(p => {
    Object.keys(p).forEach(k => {
        if (k.startsWith("1rm-")) {
            let normalizedName = k.replace("1rm-", "")
                                  .replace(/[()]/g, "") 
                                  .replace(/-+/g, " ")
                                  .trim()
                                  .toUpperCase();
            
            let val = parseFloat(p[k]);
            let dateStr = "";
            if (p.date) {
                dateStr = (typeof p.date === 'string') ? p.date.split('T')[0] : p.date.toISODate();
            } else {
                dateStr = p.file.name.split(' - ')[0];
            }

            if (!exerciseData[normalizedName]) {
                exerciseData[normalizedName] = { 
                    latest1RM: val, 
                    latestDate: dateStr, 
                    allTimePR: val,
                    link: p.file.link 
                };
            } else {
                if (val > exerciseData[normalizedName].allTimePR) {
                    exerciseData[normalizedName].allTimePR = val;
                }
                if (dateStr >= exerciseData[normalizedName].latestDate) {
                    exerciseData[normalizedName].latestDate = dateStr;
                    exerciseData[normalizedName].latest1RM = val;
                    exerciseData[normalizedName].link = p.file.link;
                }
            }
        }
    });
});

let rows = Object.entries(exerciseData).map(([name, data]) => [
    `**${name}**`,
    data.latest1RM.toFixed(1),
    data.allTimePR.toFixed(1),
    data.latestDate,
    data.link
]);

dv.table(["Exercise", "Current 1RM", "All-Time PR", "Last Date", "Note"], rows.sort((a,b) => a[0].localeCompare(b[0])));
```
It will automatically merge duplicate exercise names and show:
|Exercise|Current 1RM| All-Time PR	|  Last Date|
|-|-|-|-|
|BENCH PRESS|100 kg|105 kg|2024-05-10|
|SQUAT|140 kg|140 kg|2024-05-12|


## 🛠️ Frontmatter Structure:

Every workout note is enriched with metadata for easy querying:

```YAML
hevy_id: "abc-123"
date: 2024-05-15T18:30:00Z
exercises: ["Bench Press (Barbell)", "Triceps Extension"]
1rm-bench-press-barbell: 102.5
1rm-triceps-extension: 35.0
```

# 🔒 Commitment to Privacy

**Your fitness data is yours and yours alone. This plugin is designed with a local-first philosophy: the only network traffic generated is a direct, encrypted connection to the official Hevy API to retrieve your workout logs. No data is ever sent to third-party servers, no telemetry is collected, and your API key as well as workout data is stored securely within your local Obsidian vault. All processing, including 1RM calculations, monthly report generation, and dashboard rendering—happens entirely on your machine.**