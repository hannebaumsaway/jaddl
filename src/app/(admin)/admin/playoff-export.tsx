'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, Copy, CheckCircle } from 'lucide-react';

export function PlayoffExport() {
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [exportData, setExportData] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const yearOptions = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);
  const weekOptions = Array.from({ length: 18 }, (_, i) => i + 1);

  const handleExport = async () => {
    setIsLoading(true);
    setExportData(null);
    setCopied(false);

    try {
      const params = new URLSearchParams({
        year: selectedYear.toString(),
      });
      if (selectedWeek) {
        params.append('week', selectedWeek.toString());
      }

      const response = await fetch(`/api/export-playoff-data?${params.toString()}`);
      const data = await response.json();

      if (response.ok) {
        setExportData(data.markdown);
      } else {
        alert(`Error: ${data.error || 'Failed to export data'}`);
      }
    } catch (error) {
      console.error('Export error:', error);
      alert('Failed to export playoff data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    if (exportData) {
      await navigator.clipboard.writeText(exportData);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export Playoff Scenario Data
          </CardTitle>
          <CardDescription>
            Export standings, head-to-head records, and remaining schedule for ChatGPT analysis
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Year</label>
              <Select
                value={selectedYear.toString()}
                onValueChange={(value) => setSelectedYear(parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map(year => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Week (Optional)</label>
              <Select
                value={selectedWeek?.toString() || 'auto'}
                onValueChange={(value) => setSelectedWeek(value === 'auto' ? null : parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto (Current Week)</SelectItem>
                  {weekOptions.map(week => (
                    <SelectItem key={week} value={week.toString()}>
                      Week {week}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            onClick={handleExport}
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Download className="h-4 w-4 mr-2 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Export Data
              </>
            )}
          </Button>

          {exportData && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Export ready! Copy the markdown below and paste into ChatGPT.
                </p>
                <Button
                  onClick={handleCopy}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  {copied ? (
                    <>
                      <CheckCircle className="h-4 w-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
              <div className="relative">
                <textarea
                  readOnly
                  value={exportData}
                  className="w-full h-96 p-4 font-mono text-xs bg-muted rounded-lg border overflow-auto resize-none"
                  onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


