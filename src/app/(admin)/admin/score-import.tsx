'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Download, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Trophy,
  Calendar,
  Users,
  Activity
} from 'lucide-react';

interface LeagueInfo {
  league: {
    name: string;
    season: string;
    total_rosters: number;
    status: string;
  };
  users: Array<{
    user_id: string;
    display_name: string;
    username: string;
    metadata?: { team_name?: string };
  }>;
  nflState: {
    season: number;
    week: number;
  };
  currentSeason: number;
  currentWeek: number;
}

interface ImportResult {
  success: boolean;
  message: string;
  gamesImported?: number;
  trophyAwarded?: {
    team_id: number;
    team_name: string;
    score: number;
    isNew: boolean;
  };
  error?: string;
}

interface ValidationResult {
  valid: boolean;
  issues: string[];
}

export function ScoreImport() {
  const [leagueInfo, setLeagueInfo] = useState<LeagueInfo | null>(null);
  const [selectedYear, setSelectedYear] = useState<number>(2025);
  const [selectedWeek, setSelectedWeek] = useState<number>(1);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load league info and validation on component mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [leagueResponse, validationResponse] = await Promise.all([
        fetch('/api/admin/league-info'),
        fetch('/api/admin/validate-setup')
      ]);

      if (leagueResponse.ok) {
        const leagueData = await leagueResponse.json();
        setLeagueInfo(leagueData);
        setSelectedYear(leagueData.currentSeason);
        setSelectedWeek(leagueData.currentWeek);
      }

      if (validationResponse.ok) {
        const validationData = await validationResponse.json();
        setValidation(validationData);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImport = async () => {
    setIsImporting(true);
    setImportResult(null);

    try {
      const response = await fetch('/api/admin/import-scores', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          year: selectedYear,
          week: selectedWeek,
        }),
      });

      const result = await response.json();
      setImportResult(result);
    } catch (error) {
      setImportResult({
        success: false,
        message: 'Failed to import scores',
        error: 'Network error'
      });
    } finally {
      setIsImporting(false);
    }
  };

  const weekOptions = Array.from({ length: 18 }, (_, i) => i + 1);
  const yearOptions = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() + i);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 animate-spin" />
            Loading Score Import
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Loading league information...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* League Information */}
      {leagueInfo && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              League Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">League Name</p>
                <p className="font-medium">{leagueInfo.league.name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Season</p>
                <p className="font-medium">{leagueInfo.league.season}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Teams</p>
                <p className="font-medium">{leagueInfo.league.total_rosters}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <Badge variant="outline">{leagueInfo.league.status}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Setup Validation */}
      {validation && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {validation.valid ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
              )}
              Setup Validation
            </CardTitle>
          </CardHeader>
          <CardContent>
            {validation.valid ? (
              <p className="text-green-600">All systems ready for import!</p>
            ) : (
              <div>
                <p className="text-yellow-600 mb-2">Setup issues found:</p>
                <ul className="list-disc list-inside space-y-1">
                  {validation.issues.map((issue, index) => (
                    <li key={index} className="text-sm text-muted-foreground">
                      {issue}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Import Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Import Scores
          </CardTitle>
          <CardDescription>
            Import weekly scores from Sleeper and award Briefly Badass trophies
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Year</label>
              <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
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
              <label className="text-sm font-medium">Week</label>
              <Select value={selectedWeek.toString()} onValueChange={(value) => setSelectedWeek(parseInt(value))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {weekOptions.map(week => (
                    <SelectItem key={week} value={week.toString()}>
                      Week {week} {week >= 13 ? '(Playoffs)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button 
            onClick={handleImport} 
            disabled={isImporting || !validation?.valid}
            className="w-full"
          >
            {isImporting ? (
              <>
                <Activity className="h-4 w-4 mr-2 animate-spin" />
                Importing Scores...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Import Scores
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Import Results */}
      {importResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {importResult.success ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
              Import Results
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className={importResult.success ? 'text-green-600' : 'text-red-600'}>
              {importResult.message}
            </p>

            {importResult.success && importResult.gamesImported && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                {importResult.gamesImported} games imported
              </div>
            )}

            {importResult.trophyAwarded && (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Trophy className="h-5 w-5 text-yellow-600" />
                  <span className="font-medium text-yellow-800">Briefly Badass Trophy Awarded!</span>
                </div>
                <p className="text-sm text-yellow-700">
                  <strong>{importResult.trophyAwarded.team_name}</strong> scored {importResult.trophyAwarded.score} points
                  {importResult.trophyAwarded.isNew ? ' (first time this year!)' : ' (incrementing existing trophy)'}
                </p>
              </div>
            )}

            {importResult.error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700">
                  <strong>Error:</strong> {importResult.error}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
