import { Router } from 'express';
import { z } from 'zod';
import { diagnose, ValidationError } from '../services/diagnose.js';
import { AnswerInput } from '../types/diagnostic.js';

const singleAnswerSchema = z
  .object({
    questionId: z.string(),
    optionKey: z.string(),
  })
  .strict();

const multiAnswerSchema = z
  .object({
    questionId: z.string(),
    optionKeys: z.array(z.string()),
  })
  .strict();

const answerSchema = z.union([singleAnswerSchema, multiAnswerSchema]);

const requestSchema = z.object({
  answers: z.array(answerSchema),
});

export const diagnoseRouter = Router();

diagnoseRouter.post('/', (req, res) => {
  const parseResult = requestSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'Invalid request payload', details: parseResult.error.format() });
  }

  try {
    const answers: AnswerInput[] = parseResult.data.answers.map((answer) =>
      'optionKeys' in answer
        ? { questionId: answer.questionId, optionKeys: answer.optionKeys }
        : { questionId: answer.questionId, optionKey: answer.optionKey },
    );

    const result = diagnose(answers);
    return res.json({ typeId: result.typeId, scores: result.scores, message: result.message });
  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(400).json({ error: error.message });
    }
    // eslint-disable-next-line no-console
    console.error(error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});
