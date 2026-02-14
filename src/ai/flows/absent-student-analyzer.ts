'use server';
/**
 * @fileOverview This file defines a Genkit flow for analyzing student attendance records
 * to identify students who are likely absent based on their historical attendance patterns.
 *
 * - absentStudentAnalyzer - A function that analyzes attendance records and returns a list of students likely to be absent.
 * - AbsentStudentAnalyzerInput - The input type for the absentStudentAnalyzer function.
 * - AbsentStudentAnalyzerOutput - The return type for the absentStudentAnalyzer function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AbsentStudentAnalyzerInputSchema = z.object({
  studentRecords: z.array(
    z.object({
      name: z.string().describe('The name of the student.'),
      rollNo: z.number().describe('The roll number of the student.'),
      fingerprintID: z.string().describe('The unique fingerprint ID of the student.'),
      attendance: z.record(z.string(), z.enum(['present', 'absent'])).describe(
        'A map of attendance records with dates as keys and attendance status (present/absent) as values.'
      ),
    })
  ).describe('An array of student records, each containing name, rollNo, fingerprintID, and attendance history.'),
  currentFingerprintIDs: z.array(z.string()).describe('Array of fingerprint IDs detected during the current attendance check.'),
});
export type AbsentStudentAnalyzerInput = z.infer<typeof AbsentStudentAnalyzerInputSchema>;

const AbsentStudentAnalyzerOutputSchema = z.array(
  z.object({
    name: z.string().describe('The name of the student.'),
    rollNo: z.number().describe('The roll number of the student.'),
    fingerprintID: z.string().describe('The unique fingerprint ID of the student.'),
    reason: z.string().describe('The reason why the student is suspected to be absent (e.g., historical absence pattern).'),
  })
).describe('An array of students likely to be absent, with their names, roll numbers, fingerprint IDs, and reasons for suspicion.');
export type AbsentStudentAnalyzerOutput = z.infer<typeof AbsentStudentAnalyzerOutputSchema>;

export async function absentStudentAnalyzer(input: AbsentStudentAnalyzerInput): Promise<AbsentStudentAnalyzerOutput> {
  return absentStudentAnalyzerFlow(input);
}

const prompt = ai.definePrompt({
  name: 'absentStudentAnalyzerPrompt',
  input: {schema: AbsentStudentAnalyzerInputSchema},
  output: {schema: AbsentStudentAnalyzerOutputSchema},
  prompt: `You are an attendance analyst. Given a list of student records with their historical attendance data and a list of fingerprint IDs detected during the current attendance check, identify students who are likely absent based on their historical attendance patterns.

Consider students with frequent absences in the past as potentially absent. Explain the reason for each student identified as potentially absent.

Student Records: {{studentRecords}}
Current Fingerprint IDs: {{currentFingerprintIDs}}

Return a list of students who are likely absent, including their names, roll numbers, fingerprint IDs, and reasons for suspicion. Consider that students present in currentFingerprintIDs are present, so they are not absent.`,
});

const absentStudentAnalyzerFlow = ai.defineFlow(
  {
    name: 'absentStudentAnalyzerFlow',
    inputSchema: AbsentStudentAnalyzerInputSchema,
    outputSchema: AbsentStudentAnalyzerOutputSchema,
  },
  async input => {
    // Filter out students who are present based on current fingerprint IDs
    const potentiallyAbsentStudents = input.studentRecords.filter(student => !input.currentFingerprintIDs.includes(student.fingerprintID));

    const {output} = await prompt({...input, studentRecords: potentiallyAbsentStudents});
    return output!;
  }
);
