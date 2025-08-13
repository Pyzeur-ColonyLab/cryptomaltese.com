'use client';
import { useState, useEffect } from 'react';
import { FundFlowAnalysis } from '@/services/types/fund-flow';
import styles from './EnhancedAnalysis.module.css';

interface AnalysisProgress {
    analysisId: string;
    status: 'running' | 'completed' | 'failed';
    progress: number;
    currentStep: string;
    estimatedTimeRemaining: string;
    details: {
        addressesAnalyzed: number;
        pathsDiscovered: number;
        patternsDetected: number;
        addressesClassified: number;
        aiClassificationsUsed: number;
        cacheHitRate: number;
    };
}

export default function EnhancedAnalysis({ incidentId }: { incidentId: string }) {
    const [analysis, setAnalysis] = useState<FundFlowAnalysis | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [progress, setProgress] = useState<AnalysisProgress | null>(null);
    const [error, setError] = useState<string | null>(null);

    const startEnhancedAnalysis = async () => {
        setIsAnalyzing(true);
        setError(null);
        setProgress(null);
        
        try {
            // Start analysis
            const response = await fetch('/api/fund-flow/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    incidentId,
                    enableAIAnalysis 
                })
            });
            
            if (!response.ok) {
                throw new Error(`Analysis failed: ${response.statusText}`);
            }
            
            const { analysisId } = await response.json();
            
            // Poll for progress
            const pollProgress = setInterval(async () => {
                try {
                    const progressResponse = await fetch(`/api/fund-flow/progress/${analysisId}`);
                    
                    if (!progressResponse.ok) {
                        throw new Error(`Progress check failed: ${progressResponse.statusText}`);
                    }
                    
                    const progressData = await progressResponse.json();
                    setProgress(progressData);
                    
                    if (progressData.status === 'completed') {
                        clearInterval(pollProgress);
                        setIsAnalyzing(false);
                        // Fetch final analysis results
                        await fetchAnalysisResults(analysisId);
                    } else if (progressData.status === 'failed') {
                        clearInterval(pollProgress);
                        setIsAnalyzing(false);
                        setError('Analysis failed');
                    }
                } catch (error) {
                    console.error('Progress check failed:', error);
                    clearInterval(pollProgress);
                    setIsAnalyzing(false);
                    setError('Failed to check analysis progress');
                }
            }, 2000);
            
        } catch (error) {
            console.error('Analysis failed:', error);
            setIsAnalyzing(false);
            setError(error instanceof Error ? error.message : 'Analysis failed');
        }
    };

    const fetchAnalysisResults = async (analysisId: string) => {
        try {
            const response = await fetch(`/api/fund-flow/analyze?analysisId=${analysisId}`);
            
            if (!response.ok) {
                throw new Error(`Failed to fetch results: ${response.statusText}`);
            }
            
            const results = await response.json();
            // This would typically set the analysis state with the results
            console.log('Analysis results:', results);
            
        } catch (error) {
            console.error('Failed to fetch analysis results:', error);
            setError('Failed to fetch analysis results');
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow">
                <h2 className="text-xl font-semibold mb-4">Enhanced Fund Flow Analysis</h2>
                
                {!isAnalyzing && !analysis && (
                    <div className="space-y-4">
                        <p className="text-gray-600">
                            Run enhanced fund flow analysis to track stolen funds through multiple blockchain layers 
                            with AI-powered address classification and pattern detection.
                        </p>
                        
                                                {/* AI Analysis Toggle */}
                        <div className="aiToggleContainer">
                          <div className="aiToggleHeader">
                            <div className="aiToggleIcon">
                              🤖
                            </div>
                            <div className="aiToggleContent">
                              <label className="aiToggleLabel">
                                <input
                                  type="checkbox"
                                  checked={enableAIAnalysis}
                                  onChange={(e) => setEnableAIAnalysis(e.target.checked)}
                                  className="aiToggleInput"
                                />
                                <div className={`aiToggleSwitch ${enableAIAnalysis ? 'aiToggleSwitchActive' : ''}`}>
                                  <span className="aiToggleSlider" />
                                </div>
                                <span className="aiToggleText">
                                  Enable AI Analysis
                                </span>
                              </label>
                              <div className="aiToggleDescription">
                                {enableAIAnalysis 
                                  ? 'Claude AI will classify addresses with 5000+ transactions'
                                  : 'Only heuristic analysis will be used'
                                }
                              </div>
                            </div>
                          </div>
                          <div className="aiToggleStatus">
                            <div className={`aiToggleStatusDot ${enableAIAnalysis ? 'aiToggleStatusDotActive' : ''}`} />
                            <span className="aiToggleStatusText">
                              {enableAIAnalysis ? 'AI Analysis Active' : 'Heuristic Mode'}
                            </span>
                          </div>
                        </div>
                        
                        <button
                            onClick={startEnhancedAnalysis}
                            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            Start Enhanced Analysis
                        </button>
                    </div>
                )}
                
                {isAnalyzing && progress && (
                    <div className="space-y-4">
                        <div className="flex items-center space-x-2">
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                            <span className="font-medium">Analyzing fund flows...</span>
                        </div>
                        
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span>Progress</span>
                                <span>{progress.progress}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-3">
                                <div 
                                    className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                                    style={{ width: `${progress.progress}%` }}
                                ></div>
                            </div>
                        </div>
                        
                        <div className="bg-gray-50 p-4 rounded-lg">
                            <div className="text-sm text-gray-600 mb-2">
                                Current Step: {progress.currentStep}
                            </div>
                            <div className="text-sm text-gray-600 mb-2">
                                Estimated Time: {progress.estimatedTimeRemaining}
                            </div>
                            <div className="grid grid-cols-3 gap-4 text-sm">
                                <div>
                                    <div className="font-medium text-gray-800">{progress.details.addressesAnalyzed}</div>
                                    <div className="text-gray-600">Addresses</div>
                                </div>
                                <div>
                                    <div className="font-medium text-gray-800">{progress.details.pathsDiscovered}</div>
                                    <div className="text-gray-600">Paths</div>
                                </div>
                                <div>
                                    <div className="font-medium text-gray-800">{progress.details.patternsDetected}</div>
                                    <div className="text-gray-600">Patterns</div>
                                </div>
                            </div>
                            
                            {/* AI Classification Statistics */}
                            <div className="mt-4 pt-4 border-t border-gray-200">
                                <div className="text-sm text-gray-600 mb-2 font-medium">AI Classification Progress</div>
                                <div className="grid grid-cols-3 gap-4 text-sm">
                                    <div>
                                        <div className="font-medium text-blue-600">{progress.details.addressesClassified || 0}</div>
                                        <div className="text-gray-600">Classified</div>
                                    </div>
                                    <div>
                                        <div className="font-medium text-green-600">{progress.details.aiClassificationsUsed || 0}</div>
                                        <div className="text-gray-600">AI Used</div>
                                    </div>
                                    <div>
                                        <div className="font-medium text-purple-600">{(progress.details.cacheHitRate || 0) * 100}%</div>
                                        <div className="text-gray-600">Cache Hit</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                
                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <div className="flex items-center space-x-2">
                            <div className="text-red-500">⚠️</div>
                            <span className="text-red-700">{error}</span>
                        </div>
                        <button
                            onClick={() => setError(null)}
                            className="mt-2 text-red-600 hover:text-red-800 text-sm underline"
                        >
                            Dismiss
                        </button>
                    </div>
                )}
                
                {analysis && (
                    <div className="space-y-4">
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                            <div className="flex items-center space-x-2">
                                <div className="text-green-500">✅</div>
                            <span className="text-green-700 font-medium">Analysis completed successfully!</span>
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div className="bg-blue-50 p-4 rounded-lg">
                                <div className="text-2xl font-bold text-blue-600">{analysis.paths.length}</div>
                                <div className="text-blue-800">Transaction Paths</div>
                            </div>
                            <div className="bg-green-50 p-4 rounded-lg">
                                <div className="text-2xl font-bold text-green-600">{analysis.patterns.length}</div>
                                <div className="text-green-800">Patterns Detected</div>
                            </div>
                            <div className="bg-orange-50 p-4 rounded-lg">
                                <div className="text-2xl font-bold text-orange-600">{analysis.endpoints.length}</div>
                                <div className="text-orange-800">Endpoints Found</div>
                            </div>
                        </div>
                        
                        <div className="bg-gray-50 p-4 rounded-lg">
                            <h3 className="font-medium text-gray-800 mb-2">Analysis Summary</h3>
                            <div className="text-sm text-gray-600">
                                <div>Confidence Score: {(analysis.confidenceScore * 100).toFixed(1)}%</div>
                                <div>Status: {analysis.status}</div>
                                <div>Created: {analysis.createdAt.toLocaleDateString()}</div>
                                {analysis.completedAt && (
                                    <div>Completed: {analysis.completedAt.toLocaleDateString()}</div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
} 