import { SuggestModal, TFile, App } from 'obsidian';

export class ExerciseSuggestModal extends SuggestModal<string> {
    exercises: string[];
    onChoose: (result: string) => void;

    constructor(app: App, exercises: string[], onChoose: (result: string) => void) {
        super(app);
        this.exercises = exercises;
        this.onChoose = onChoose;
        this.setPlaceholder("Search for an exercise...");
    }

    getSuggestions(query: string): string[] {
        return this.exercises.filter((ex) =>
            ex.toLowerCase().includes(query.toLowerCase())
        );
    }

    renderSuggestion(ex: string, el: HTMLElement) {
        el.createEl("div", { text: ex });
    }

    onChooseSuggestion(ex: string, evt: MouseEvent | KeyboardEvent) {
        this.onChoose(ex);
    }
}