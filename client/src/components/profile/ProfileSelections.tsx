import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ProfileSelectionsProps {
  userId: string;
  username: string;
}

export default function ProfileSelections({ userId, username }: ProfileSelectionsProps) {
  const [selectedStatus, setSelectedStatus] = useState<'active' | 'completed' | 'upcoming'>('active');
  
  const { data: userSelections, isLoading } = useQuery({
    queryKey: [`/api/users/${userId}/selections`],
    enabled: !!userId,
  });
  
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Selection History</CardTitle>
          <Tabs defaultValue="active">
            <TabsList>
              <TabsTrigger value="active">Active</TabsTrigger>
              <TabsTrigger value="completed">Completed</TabsTrigger>
              <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }
  
  const getFilteredSelections = () => {
    if (!userSelections) return [];
    
    switch (selectedStatus) {
      case 'active':
        return userSelections.filter(s => s.competition.isActive);
      case 'completed':
        return userSelections.filter(s => s.competition.isComplete);
      case 'upcoming':
        return userSelections.filter(s => !s.competition.isActive && !s.competition.isComplete);
      default:
        return userSelections;
    }
  };
  
  const filteredSelections = getFilteredSelections();
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Selection History</CardTitle>
        <Tabs 
          defaultValue="active" 
          onValueChange={(value) => setSelectedStatus(value as 'active' | 'completed' | 'upcoming')}
        >
          <TabsList>
            <TabsTrigger value="active">
              Active
              {userSelections?.filter(s => s.competition.isActive).length > 0 && (
                <span className="ml-2 px-2 py-0.5 text-xs bg-primary/10 text-primary rounded-full">
                  {userSelections.filter(s => s.competition.isActive).length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="completed">
              Completed
              {userSelections?.filter(s => s.competition.isComplete).length > 0 && (
                <span className="ml-2 px-2 py-0.5 text-xs bg-slate-200 text-slate-800 rounded-full">
                  {userSelections.filter(s => s.competition.isComplete).length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="upcoming">
              Upcoming
              {userSelections?.filter(s => !s.competition.isActive && !s.competition.isComplete).length > 0 && (
                <span className="ml-2 px-2 py-0.5 text-xs bg-amber-100 text-amber-800 rounded-full">
                  {userSelections.filter(s => !s.competition.isActive && !s.competition.isComplete).length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent className="p-0">
        {filteredSelections.length === 0 ? (
          <div className="text-center py-10 text-gray-500">
            No {selectedStatus} competition selections found for {username}.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Competition</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Selection 1</TableHead>
                <TableHead>Selection 2</TableHead>
                <TableHead>Selection 3</TableHead>
                <TableHead className="text-right">Points</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSelections.map((selection) => (
                <TableRow key={selection.id}>
                  <TableCell className="font-medium">
                    <div>
                      <div>{selection.competition.name}</div>
                      <div className="text-xs text-gray-500">{selection.competition.venue}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      {new Date(selection.competition.startDate).toLocaleDateString()}
                      {" - "}
                      {new Date(selection.competition.endDate).toLocaleDateString()}
                    </div>
                    <div className="mt-1">
                      {selection.competition.isComplete ? (
                        <Badge variant="outline" className="bg-slate-100 text-slate-800">Completed</Badge>
                      ) : selection.competition.isActive ? (
                        <Badge variant="outline" className="bg-amber-100 text-amber-800">Active</Badge>
                      ) : (
                        <Badge variant="outline" className="bg-primary/10 text-primary">Upcoming</Badge>
                      )}
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    <div className="flex items-center">
                      {selection.golfer1?.avatar ? (
                        <img 
                          className="h-6 w-6 rounded-full mr-2" 
                          src={selection.golfer1.avatar} 
                          alt={selection.golfer1.name} 
                        />
                      ) : (
                        <div className="h-6 w-6 rounded-full bg-gray-200 flex items-center justify-center mr-2">
                          <span className="text-xs font-medium text-gray-800">
                            {selection.golfer1?.name.charAt(0)}
                          </span>
                        </div>
                      )}
                      <div>
                        <div>{selection.golfer1?.name}</div>
                        {selection.golfer1Result && (
                          <div className="text-xs text-gray-500">
                            Position: {selection.golfer1Result.position}, 
                            Points: <span className="text-success font-medium">+{selection.golfer1Result.points}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    <div className="flex items-center">
                      {selection.golfer2?.avatar ? (
                        <img 
                          className="h-6 w-6 rounded-full mr-2" 
                          src={selection.golfer2.avatar} 
                          alt={selection.golfer2.name} 
                        />
                      ) : (
                        <div className="h-6 w-6 rounded-full bg-gray-200 flex items-center justify-center mr-2">
                          <span className="text-xs font-medium text-gray-800">
                            {selection.golfer2?.name.charAt(0)}
                          </span>
                        </div>
                      )}
                      <div>
                        <div>{selection.golfer2?.name}</div>
                        {selection.golfer2Result && (
                          <div className="text-xs text-gray-500">
                            Position: {selection.golfer2Result.position}, 
                            Points: <span className="text-success font-medium">+{selection.golfer2Result.points}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    <div className="flex items-center">
                      {selection.golfer3?.avatar ? (
                        <img 
                          className="h-6 w-6 rounded-full mr-2" 
                          src={selection.golfer3.avatar} 
                          alt={selection.golfer3.name} 
                        />
                      ) : (
                        <div className="h-6 w-6 rounded-full bg-gray-200 flex items-center justify-center mr-2">
                          <span className="text-xs font-medium text-gray-800">
                            {selection.golfer3?.name.charAt(0)}
                          </span>
                        </div>
                      )}
                      <div>
                        <div>{selection.golfer3?.name}</div>
                        {selection.golfer3Result && (
                          <div className="text-xs text-gray-500">
                            Position: {selection.golfer3Result.position}, 
                            Points: <span className="text-success font-medium">+{selection.golfer3Result.points}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  
                  <TableCell className="text-right font-medium">
                    {selection.competition.isActive || selection.competition.isComplete ? (
                      <span className="text-lg">{selection.totalPoints || 0}</span>
                    ) : (
                      <span className="text-sm text-gray-400">Pending</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
