import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { REPORT_REASONS, type ReportTarget } from '@sciehub/shared';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useAuth } from '@/context/AuthContext';
import { useToast } from './Toast';

interface ReportDialogProps {
  targetType: ReportTarget;
  targetId: string;
  trigger: ReactNode;
}

export function ReportDialog({ targetType, targetId, trigger }: ReportDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');

  const mutation = useMutation({
    mutationFn: () => api('/reports', { method: 'POST', json: { targetType, targetId, reason } }),
    onSuccess: () => {
      setOpen(false);
      setReason('');
      toast('Thanks — your report has been submitted', 'success');
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Could not submit report', 'error'),
  });

  const onOpenChange = (next: boolean) => {
    if (next && !user) {
      navigate('/auth', { state: { from: window.location.pathname } });
      return;
    }
    setOpen(next);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Report this {targetType === 'repo' ? 'repository' : 'comment'}</DialogTitle>
          <DialogDescription>
            Help keep SCIEHub respectful. Reports are reviewed by the community team and can lead to content removal.
          </DialogDescription>
        </DialogHeader>
        <Select value={reason} onValueChange={setReason}>
          <SelectTrigger>
            <SelectValue placeholder="Choose a reason" />
          </SelectTrigger>
          <SelectContent>
            {REPORT_REASONS.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={() => mutation.mutate()} disabled={!reason || mutation.isPending}>
            Submit report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
