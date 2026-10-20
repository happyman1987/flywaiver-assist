import React from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import DiagnosisImage from "@/components/DiagnosisImage";

const statusVariant = {
  draft: "secondary",
  generated: "default",
  submitted: "default"
};

export default function CaseListCard({ item, actions }) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="py-4 flex items-center justify-between gap-3">
        <Link to={`/cases/${item.id}`} className="flex items-center gap-3 flex-1 min-w-0">
          <DiagnosisImage diagnosis={item.diagnosis} />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-medium truncate">{item.member_name}</p>
              <Badge variant={statusVariant[item.status] || "secondary"} className="capitalize">{item.status}</Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5 truncate">{item.diagnosis}</p>
          </div>
        </Link>
        <div className="flex items-center gap-2 shrink-0">
          <div className="text-right text-xs text-muted-foreground hidden sm:block mr-1">
            <p>{item.flying_class || "—"}</p>
            <p>{item.unit || "—"}</p>
          </div>
          {actions}
        </div>
      </CardContent>
    </Card>
  );
}