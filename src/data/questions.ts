import questionsJson from '../../data/questions.json' with { type: 'json' };
import { Question } from '../types/diagnostic.js';

const typedQuestions = questionsJson as unknown as Question[];

export const questions: Question[] = typedQuestions;

export const questionMap = new Map<string, Question>(
  questions.map((question) => [question.id, question]),
);
