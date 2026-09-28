export type Step = 1 | 2 | 3 | 4 | 5;
export type Profile = { name?: string; location?: string; grade?: string; dream?: string };
export type Message = { id: string; role: 'teacher' | 'student'; text: string; time: string; audioUrl?: string };
export type ChatResponse = { reply: string; profile: Profile; currentStep: Step; accepted: boolean; audioUrl?: string; unlock?: string };
