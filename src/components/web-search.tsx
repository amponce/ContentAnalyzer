import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Loader2, Search, ExternalLink } from "lucide-react";
import { AI_MODELS } from '@/lib/constants/ai-models';

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  relevance: number;
}

export function WebSearch() {
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!query.trim()) return;

    setSearching(true);
    setError(null);

    try {
      const { apiKey } = await chrome.storage.sync.get(['apiKey']);
      if (!apiKey) {
        throw new Error('Please configure your OpenAI API key first');
      }

      // First get search results
      const searchResponse = await fetch('https://api.openai.com/v1/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          query: query.trim(),
          max_results: 5
        })
      });

      if (!searchResponse.ok) {
        throw new Error('Search request failed');
      }

      const searchData = await searchResponse.json();

      // Then process results with GPT
      const processResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: AI_MODELS.WEB_SEARCH,
          messages: [
            {
              role: 'system',
              content: 'You are a search results processor. Format the search results into a clear, structured format with titles, snippets, and relevance scores.'
            },
            {
              role: 'user',
              content: `Process these search results for the query "${query}":\n${JSON.stringify(searchData)}`
            }
          ],
          response_format: { type: "json_object" }
        })
      });

      const processData = await processResponse.json();
      if (processData.error) {
        throw new Error(processData.error.message);
      }

      const formattedResults = JSON.parse(processData.choices[0].message.content);
      setResults(formattedResults.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Search error:', err);
    } finally {
      setSearching(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Web Search</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <div className="flex-1">
              <Label htmlFor="search-query" className="sr-only">Search Query</Label>
              <Input
                id="search-query"
                placeholder="Enter your search query..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={searching}
              />
            </div>
            <Button
              onClick={handleSearch}
              disabled={searching || !query.trim()}
            >
              {searching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              <span className="ml-2">Search</span>
            </Button>
          </div>

          {error && (
            <div className="text-red-500 p-2 rounded bg-red-50">
              {error}
            </div>
          )}

          {results.length > 0 && (
            <div className="space-y-4">
              {results.map((result, index) => (
                <div key={index} className="border rounded p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-lg">
                      {result.title}
                    </h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => window.open(result.url, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {result.snippet}
                  </p>
                  <div className="mt-2 flex items-center">
                    <span className="text-xs text-muted-foreground">
                      Relevance: {(result.relevance * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 