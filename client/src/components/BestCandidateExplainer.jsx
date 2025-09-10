import React, { useState } from 'react';

function BestCandidateExplainer({ solution }) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  if (!solution) return null;
  
  // Calculate the scoring breakdown
  const ltv_cac_ratio = solution.ltv_estimate && solution.cac_estimate 
    ? (solution.ltv_estimate / solution.cac_estimate).toFixed(2)
    : 0;
  
  const viabilityScore = (solution.overall_viability || 0) * 0.4;
  const ltvcacScore = Math.min(ltv_cac_ratio * 5, 50) * 0.3;
  const problemScore = (solution.problem_count || 0) * 2 * 0.3;
  const totalScore = viabilityScore + ltvcacScore + problemScore;
  
  return (
    <div className="bg-gradient-to-r from-yellow-50 to-amber-50 rounded-lg p-4 border-2 border-yellow-400">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">🏆</span>
            <h3 className="text-lg font-bold text-gray-900">Best Candidate</h3>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="ml-2 p-1 text-gray-500 hover:text-gray-700 hover:bg-yellow-100 rounded-lg transition-colors"
              title="See scoring breakdown"
            >
              {isExpanded ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              )}
            </button>
          </div>
          
          <div className="flex items-center gap-4 text-sm">
            <span className="font-medium text-gray-700">
              Total Score: <span className="text-xl font-bold text-yellow-700">{totalScore.toFixed(1)}</span>
            </span>
            {!isExpanded && (
              <span className="text-gray-500 italic">
                (Click to see how this is calculated)
              </span>
            )}
          </div>
        </div>
      </div>
      
      {isExpanded && (
        <div className="mt-4 space-y-4">
          {/* Formula Explanation */}
          <div className="bg-white/70 rounded-lg p-3 border border-yellow-300">
            <div className="flex items-start gap-2 mb-2">
              <svg className="w-5 h-5 text-yellow-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-sm text-gray-700">
                <p className="font-semibold mb-1">Selection Formula:</p>
                <code className="bg-gray-100 px-2 py-1 rounded text-xs">
                  Score = (Viability × 40%) + (LTV:CAC × 30%) + (Problems × 30%)
                </code>
              </div>
            </div>
          </div>
          
          {/* Score Breakdown */}
          <div className="space-y-3">
            {/* Viability Component */}
            <div className="bg-white/50 rounded-lg p-3">
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-medium text-gray-700">Viability Score</span>
                <span className="text-sm font-bold">{viabilityScore.toFixed(1)} pts</span>
              </div>
              <div className="text-xs text-gray-600">
                {solution.overall_viability}% viability × 40% weight = {viabilityScore.toFixed(1)}
              </div>
              <div className="mt-2 bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-green-500 h-2 rounded-full transition-all"
                  style={{ width: `${(viabilityScore / 40) * 100}%` }}
                />
              </div>
            </div>
            
            {/* LTV:CAC Component */}
            <div className="bg-white/50 rounded-lg p-3">
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-medium text-gray-700">LTV:CAC Ratio Score</span>
                <span className="text-sm font-bold">{ltvcacScore.toFixed(1)} pts</span>
              </div>
              <div className="text-xs text-gray-600">
                £{solution.ltv_estimate || 0} ÷ £{solution.cac_estimate || 0} = {ltv_cac_ratio}:1 ratio
                <br />
                Min({ltv_cac_ratio} × 5, 50) × 30% weight = {ltvcacScore.toFixed(1)}
              </div>
              <div className="mt-2 bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-500 h-2 rounded-full transition-all"
                  style={{ width: `${(ltvcacScore / 15) * 100}%` }}
                />
              </div>
            </div>
            
            {/* Problems Solved Component */}
            <div className="bg-white/50 rounded-lg p-3">
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-medium text-gray-700">Problems Addressed Score</span>
                <span className="text-sm font-bold">{problemScore.toFixed(1)} pts</span>
              </div>
              <div className="text-xs text-gray-600">
                {solution.problem_count || 0} problems × 2 × 30% weight = {problemScore.toFixed(1)}
              </div>
              <div className="mt-2 bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-purple-500 h-2 rounded-full transition-all"
                  style={{ width: `${Math.min((problemScore / 30) * 100, 100)}%` }}
                />
              </div>
            </div>
          </div>
          
          {/* Total Score Summary */}
          <div className="bg-yellow-100 rounded-lg p-3 border border-yellow-300">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-gray-800">Total Selection Score:</span>
              <span className="text-2xl font-bold text-yellow-700">{totalScore.toFixed(1)}</span>
            </div>
            <div className="text-xs text-gray-600 mt-1">
              Maximum possible score: 100 points
            </div>
          </div>
          
          {/* Why This Matters */}
          <div className="text-xs text-gray-600 italic">
            This scoring system balances business viability (40%), unit economics (30%), 
            and problem coverage (30%) to identify solutions with the highest success potential.
          </div>
        </div>
      )}
    </div>
  );
}

export default BestCandidateExplainer;