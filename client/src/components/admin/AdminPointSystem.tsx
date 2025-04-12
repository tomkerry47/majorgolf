import { useState, useEffect } from "react";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { PointSystem } from "@shared/schema";
import { Loader2 } from "lucide-react";

export default function AdminPointSystem() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editMode, setEditMode] = useState<Record<number, boolean>>({});
  const [editValues, setEditValues] = useState<Record<number, number>>({});

  // Fetch point system data
  const { data: pointsData, isLoading } = useQuery<PointSystem[]>({
    queryKey: ['/api/admin/point-system'],
    retry: 1,
  });

  // Update point values mutation
  const { mutate: updatePoints, isPending: isUpdating } = useMutation({
    mutationFn: async ({ position, points }: { position: number, points: number }) => {
      return apiRequest(`/api/admin/point-system/${position}`, 'PATCH', { points });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/point-system'] });
      toast({
        title: "Points updated successfully",
        description: "The point values have been updated.",
      });
      // Reset edit mode
      setEditMode({});
    },
    onError: (error: any) => {
      toast({
        title: "Error updating points",
        description: error.message || "An error occurred while updating the points.",
        variant: "destructive",
      });
    }
  });

  // Initialize edit values when data is loaded
  useEffect(() => {
    if (pointsData) {
      const initialValues: Record<number, number> = {};
      pointsData.forEach((item: PointSystem) => {
        initialValues[item.position] = item.points;
      });
      setEditValues(initialValues);
    }
  }, [pointsData]);

  const handleEdit = (position: number) => {
    setEditMode((prev) => ({ ...prev, [position]: true }));
  };

  const handleSave = (position: number) => {
    const newPoints = editValues[position];
    updatePoints({ position, points: newPoints });
  };

  const handleCancel = (position: number) => {
    if (pointsData) {
      const point = pointsData.find((p: PointSystem) => p.position === position);
      if (point) {
        setEditValues((prev) => ({ ...prev, [position]: point.points }));
      }
    }
    setEditMode((prev) => ({ ...prev, [position]: false }));
  };

  const handleInputChange = (position: number, value: string) => {
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue)) {
      setEditValues((prev) => ({ ...prev, [position]: numValue }));
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Point System Management</CardTitle>
        <CardDescription>
          Manage the point values for different positions in tournaments.
         </CardDescription>
       </CardHeader>
       <CardContent>
         <div className="overflow-x-auto"> {/* Added wrapper */}
           <Table>
             <TableCaption>Points awarded based on final tournament position.</TableCaption>
             <TableHeader>
               <TableRow>
              <TableHead>Position</TableHead>
              <TableHead>Points</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pointsData?.sort((a: PointSystem, b: PointSystem) => {
              // Sort by position, but keep position 0 (missed cut) at the end
              if (a.position === 0) return 1;
              if (b.position === 0) return -1;
              return a.position - b.position;
            }).map((point: PointSystem) => (
              <TableRow key={point.position}>
                <TableCell>
                  {point.position === 0 ? "Missed Cut" : getOrdinalSuffix(point.position)}
                </TableCell>
                <TableCell>
                  {editMode[point.position] ? (
                    <Input
                      type="number"
                      value={editValues[point.position]}
                      onChange={(e) => handleInputChange(point.position, e.target.value)}
                      className="w-24"
                    />
                  ) : (
                    <span>{point.points}</span>
                  )}
                </TableCell>
                <TableCell>
                  {editMode[point.position] ? (
                    <div className="flex space-x-2">
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => handleSave(point.position)}
                        disabled={isUpdating}
                      >
                        {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCancel(point.position)}
                        disabled={isUpdating}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEdit(point.position)}
                    >
                      Edit
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
           </TableBody>
         </Table>
         </div> {/* Close wrapper */}
       </CardContent>
     </Card>
  );
}

function getOrdinalSuffix(num: number): string {
  const suffixes = ["th", "st", "nd", "rd"];
  const v = num % 100;
  return num + (suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]);
}
