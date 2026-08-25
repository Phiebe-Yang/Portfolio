import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'test/acceptanceCriteria.spec.ts',
      'test/citationIntegrity.spec.ts',
      'test/claimAccuracy.spec.ts',
      'test/clinicalRetrieval.spec.ts',
      'test/e2eProductionPipeline.spec.ts',
      'test/eligibilityGate.spec.ts',
      'test/evaluationBenchmark.spec.ts',
      'test/index.spec.ts',
      'test/physicianFeedbackRegression.spec.ts',
      'test/professionalUI.spec.ts',
      'test/transparency.spec.ts',
      'test/answerFormatting.spec.ts',
    ],
  },
});
