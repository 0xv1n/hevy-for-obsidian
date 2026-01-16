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

export async function fetchWorkouts(apiKey: string, limit: number) {
    const response = await fetch(`https://api.hevyapp.com/v1/workouts?page=1&pageSize=${limit}`, {
        method: 'GET',
        headers: { 'api-key': apiKey, 'Content-Type': 'application/json' }
    });
    return response.ok ? await response.json() : null;
}

export async function fetchWorkoutDetails(apiKey: string, workoutId: string): Promise<HevyWorkout | null> {
    const response = await fetch(`https://api.hevyapp.com/v1/workouts/${workoutId}`, {
        method: 'GET',
        headers: { 'api-key': apiKey, 'Content-Type': 'application/json' }
    });
    return response.ok ? await response.json() : null;
}