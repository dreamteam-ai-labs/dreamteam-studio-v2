import React from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

function ClusterVisualization({ scenario }) {
  if (!scenario || !scenario.clusters) return null;

  // Prepare data for the chart
  const clusterData = scenario.clusters
    .filter(c => !c.is_outlier)
    .sort((a, b) => b.item_count - a.item_count)
    .slice(0, 20); // Top 20 clusters

  const outlierCluster = scenario.clusters.find(c => c.is_outlier);

  const chartData = {
    labels: [
      ...clusterData.map((c, i) => c.label || `Cluster ${i + 1}`),
      ...(outlierCluster ? ['Outliers'] : [])
    ],
    datasets: [{
      label: 'Items per Cluster',
      data: [
        ...clusterData.map(c => c.item_count),
        ...(outlierCluster ? [outlierCluster.item_count] : [])
      ],
      backgroundColor: [
        ...clusterData.map(() => 'rgba(59, 130, 246, 0.6)'), // Blue for regular clusters
        ...(outlierCluster ? ['rgba(239, 68, 68, 0.6)'] : []) // Red for outliers
      ],
      borderColor: [
        ...clusterData.map(() => 'rgba(59, 130, 246, 1)'),
        ...(outlierCluster ? ['rgba(239, 68, 68, 1)'] : [])
      ],
      borderWidth: 1
    }]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      title: {
        display: true,
        text: `Cluster Distribution (K=${scenario.k_value}, Threshold=${scenario.similarity_threshold})`
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const value = context.parsed.y;
            const total = scenario.total_items;
            const percentage = ((value / total) * 100).toFixed(1);
            return `${value} items (${percentage}%)`;
          }
        }
      }
    },
    scales: {
      x: {
        ticks: {
          autoSkip: true,
          maxRotation: 45,
          minRotation: 45
        }
      },
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Number of Items'
        }
      }
    }
  };

  return (
    <div className="h-64 p-4">
      <Bar data={chartData} options={options} />
    </div>
  );
}

export default ClusterVisualization;