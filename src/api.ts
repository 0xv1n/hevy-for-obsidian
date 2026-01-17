import { requestUrl } from 'obsidian';

export interface HevySet {
    weight_kg: number | null;
    reps: number | null;
    type: string;
    rpe: number | null;
}

export interface HevyExercise {
    title: string;
    sets: HevySet[];
}

export interface HevyWorkout {
    id: string;
    title: string;
    description: string;
    start_time: string;
    end_time: string;
    exercises: HevyExercise[];
}

export interface HevyWorkoutsResponse {
    workouts: HevyWorkout[];
    page: number;
    page_count: number;
}

export async function fetchWorkouts(apiKey: string, limit: number): Promise<HevyWorkoutsResponse | null> {
    try {
        const response = await requestUrl({
            url: `https://api.hevyapp.com/v1/workouts?page=1&pageSize=${limit}`,
            method: 'GET',
            headers: { 'api-key': apiKey, 'Content-Type': 'application/json' }
        });
        return response.status === 200 ? response.json : null;
    } catch (error) {
        console.error("Hevy Sync: Error fetching workouts", error);
        return null;
    }
}

export async function fetchWorkoutDetails(apiKey: string, workoutId: string): Promise<HevyWorkout | null> {
    try {
        const response = await requestUrl({
            url: `https://api.hevyapp.com/v1/workouts/${workoutId}`,
            method: 'GET',
            headers: { 'api-key': apiKey, 'Content-Type': 'application/json' }
        });
        return response.status === 200 ? response.json : null;
    } catch (error) {
        console.error("Hevy Sync: Error fetching workout details", error);
        return null;
    }
}