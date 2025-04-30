import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Loader2 } from "lucide-react";

interface SettingsProps {
  onSave: () => void;
}

export function Settings({ onSave }: SettingsProps) {
  const [apiKey, setApiKey] = useState('');
  const [instructions, setInstructions] = useState(
    'Please analyze the sentiment of this Medallia survey feedback, considering factors such as tone, language, and context. Identify key themes and emotional indicators.'
  );
  const [batchSize, setBatchSize] = useState('5');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    // Load saved settings
    chrome.storage.sync.get(['apiKey', 'instructions', 'batchSize'], (data) => {
      if (data.apiKey) setApiKey(data.apiKey);
      if (data.instructions) setInstructions(data.instructions);
      if (data.batchSize) setBatchSize(data.batchSize);
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await chrome.storage.sync.set({
        apiKey,
        instructions,
        batchSize: parseInt(batchSize)
      });
      onSave();
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    setTesting(true);
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [{ role: 'user', content: 'Test connection' }],
          max_tokens: 5
        })
      });
      
      if (!response.ok) {
        throw new Error('API connection failed');
      }
      
      // If we get here, the connection was successful
      alert('API connection successful!');
    } catch (error) {
      alert('API connection failed. Please check your API key.');
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Settings</CardTitle>
        <CardDescription>Configure your sentiment analysis settings</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="apiKey">OpenAI API Key</Label>
          <Input
            id="apiKey"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Enter your OpenAI API key"
          />
          <Button 
            variant="outline" 
            size="sm"
            onClick={testConnection}
            disabled={!apiKey || testing}
          >
            {testing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Testing...
              </>
            ) : (
              'Test Connection'
            )}
          </Button>
          <p className="text-sm text-muted-foreground">
            Your API key will be stored locally
          </p>
        </div>

        <Separator />

        <div className="space-y-2">
          <Label htmlFor="instructions">Analysis Instructions</Label>
          <Textarea
            id="instructions"
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="Enter instructions for sentiment analysis"
            className="min-h-[100px]"
          />
        </div>

        <Separator />

        <div className="space-y-2">
          <Label htmlFor="batchSize">Batch Size</Label>
          <Input
            id="batchSize"
            type="number"
            min="1"
            max="10"
            value={batchSize}
            onChange={(e) => setBatchSize(e.target.value)}
          />
          <p className="text-sm text-muted-foreground">
            Number of responses to analyze at once
          </p>
        </div>
      </CardContent>
      <CardFooter>
        <Button 
          className="w-full" 
          onClick={handleSave}
          disabled={!apiKey || saving}
        >
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            'Save Settings'
          )}
        </Button>
      </CardFooter>
    </Card>
  );
} 