
"use client";

import type { AbsentStudentAnalyzerOutput } from "@/ai/flows/absent-student-analyzer";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, UserX } from "lucide-react";

type AbsenceAnalysisReportProps = {
  result: AbsentStudentAnalyzerOutput;
};

export function AbsenceAnalysisReport({ result }: AbsenceAnalysisReportProps) {

  return (
    <Card className="shadow-lg border-primary/20 hover:border-primary/50 transition-all duration-300">
      <CardHeader className="bg-primary/5 rounded-t-lg">
        <CardTitle className="flex items-center gap-2 text-primary">
          <AlertTriangle />
          Absence Analysis Report
        </CardTitle>
        <CardDescription>
          The following students were identified as likely absent.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-6">
        {result.map((student) => (
          <div key={student.fingerprintID} className="flex items-start gap-4 p-3 rounded-md bg-secondary/50">
            <div className="flex-shrink-0 pt-1">
               <UserX className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="font-semibold text-card-foreground">({student.rollNo}) {student.name}</p>
              <p className="text-sm text-muted-foreground">{student.reason}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
