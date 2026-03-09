import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

type MailTestResponse = {
  success: boolean;
  logs: string[];
  result?: {
    provider: string;
    from: string;
    to: string;
    subject: string;
  };
  error?: string;
};

export default function AdminMailTest() {
  const [recipient, setRecipient] = useState("");
  const [lastResult, setLastResult] = useState<MailTestResponse | null>(null);
  const { toast } = useToast();

  const sendTestMutation = useMutation({
    mutationFn: (to: string) => apiRequest<MailTestResponse>("/api/admin/mail/test", "POST", { to }),
    onSuccess: (data) => {
      setLastResult(data);
      toast({
        title: "Test email sent",
        description: data.result ? `Sent to ${data.result.to}` : "Mail test completed.",
      });
    },
    onError: (error: any) => {
      const message = error.message || "Mail test failed";
      setLastResult({
        success: false,
        logs: [`Mail test failed: ${message}`],
        error: message,
      });
      toast({
        title: "Mail test failed",
        description: message,
        variant: "destructive",
      });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Email Test</CardTitle>
        <CardDescription>
          Send a test message through Microsoft Graph and inspect the server response.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="mail-test-recipient">Recipient Email</Label>
          <Input
            id="mail-test-recipient"
            type="email"
            placeholder="Leave blank to use your admin email"
            value={recipient}
            onChange={(event) => setRecipient(event.target.value)}
          />
        </div>

        <Button
          onClick={() => sendTestMutation.mutate(recipient)}
          disabled={sendTestMutation.isPending}
        >
          {sendTestMutation.isPending ? "Sending..." : "Send Test Email"}
        </Button>

        {lastResult && (
          <div className="space-y-3 rounded-md border bg-slate-50 p-4">
            <div className="text-sm font-medium text-slate-900">
              {lastResult.success ? "Last test succeeded" : "Last test failed"}
            </div>
            {lastResult.result && (
              <div className="text-sm text-slate-700">
                {`From: ${lastResult.result.from} | To: ${lastResult.result.to} | Subject: ${lastResult.result.subject}`}
              </div>
            )}
            <pre className="overflow-x-auto whitespace-pre-wrap rounded bg-slate-900 p-3 text-xs text-slate-100">
              {lastResult.logs.join("\n")}
            </pre>
            {lastResult.error && (
              <div className="text-sm text-red-600">{lastResult.error}</div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
