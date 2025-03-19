import { useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import TournamentResults from '@/components/admin/TournamentResults';

export default function TournamentResultDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  
  // Redirect to tournaments page if no ID
  useEffect(() => {
    if (!id) {
      setLocation('/admin/tournament-results');
    }
  }, [id, setLocation]);
  
  // Go back to tournaments list
  const handleBack = () => {
    setLocation('/admin/tournament-results');
  };
  
  if (!id) return null;
  
  return <TournamentResults competitionId={id} onBack={handleBack} />;
}