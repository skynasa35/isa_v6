import type { VibrationAnalysisResult, SummaryData, VibrationRecord, SpsPoint, SummaryIndividual } from '../types';
import { calculateSlopeAndAspect } from './terrainService';
// Fix: Import turf functions and types explicitly
import { booleanPointInPolygon, point } from '@turf/turf';
import type { FeatureCollection, Polygon } from 'geojson';

export const getNumericId = (vibroId: string): number => {
    const match = vibroId.match(/\d+/);
    return match ? parseInt(match[0], 10) : 0;
};

const formatDuration = (totalSeconds: number): string => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    return `${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m`;
};

export const formatDurationForStatsLabel = (totalSeconds: number): string => {
    if (totalSeconds < 60) return `${Math.round(totalSeconds)}s`;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    if (hours > 0) {
        return `${hours}h${minutes}m`;
    }
    return `${minutes}m`;
};

export const formatDurationForTooltip = (totalSeconds: number): string => {
    if (isNaN(totalSeconds) || totalSeconds < 0) return '0h00m';
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    return `${hours}h${String(minutes).padStart(2, '0')}m`;
};

// VAPS Parser
const fieldDefinitions: { name: keyof VibrationRecord, start: number, end: number, type: 'string' | 'integer' | 'float' }[] = [
  { name: 'recordIdentification', start: 0, end: 1, type: 'string' },
  { name: 'lineName', start: 1, end: 17, type: 'string' },
  { name: 'pointNumber', start: 17, end: 25, type: 'string' },
  { name: 'pointIndex', start: 25, end: 26, type: 'integer' },
  { name: 'fleetNumber', start: 26, end: 27, type: 'string' },
  { name: 'vibratorNumber', start: 27, end: 29, type: 'integer' },
  { name: 'vibratorDriveLevel', start: 29, end: 32, type: 'integer' },
  { name: 'averagePhase', start: 32, end: 36, type: 'integer' },
  { name: 'peakPhase', start: 36, end: 40, type: 'integer' },
  { name: 'averageDistortion', start: 40, end: 42, type: 'integer' },
  { name: 'peakDistortion', start: 42, end: 44, type: 'integer' },
  { name: 'averageForce', start: 44, end: 46, type: 'integer' },
  { name: 'peakForce', start: 46, end: 49, type: 'integer' },
  { name: 'averageGroundStiffness', start: 49, end: 52, type: 'integer' },
  { name: 'averageGroundViscosity', start: 52, end: 55, type: 'integer' },
  { name: 'vibPositionEasting', start: 55, end: 64, type: 'float' },
  { name: 'vibPositionNorthing', start: 64, end: 74, type: 'float' },
  { name: 'vibPositionElevation', start: 74, end: 80, type: 'float' },
  { name: 'shotNb', start: 81, end: 86, type: 'integer' },
  { name: 'acquisitionNb', start: 86, end: 88, type: 'integer' },
  { name: 'twoDigitsFleetNumber', start: 88, end: 90, type: 'integer' },
  { name: 'vibStatusCode', start: 90, end: 92, type: 'integer' },
  { name: 'mass1Warning', start: 93, end: 94, type: 'string' },
  { name: 'mass2Warning', start: 94, end: 95, type: 'string' },
  { name: 'mass3Warning', start: 95, end: 96, type: 'string' },
  { name: 'plate1Warning', start: 99, end: 100, type: 'string' },
  { name: 'plate2Warning', start: 100, end: 101, type: 'string' },
  { name: 'plate3Warning', start: 101, end: 102, type: 'string' },
  { name: 'plate4Warning', start: 102, end: 103, type: 'string' },
  { name: 'plate5Warning', start: 103, end: 104, type: 'string' },
  { name: 'plate6Warning', start: 104, end: 105, type: 'string' },
  { name: 'forceOverload', start: 105, end: 106, type: 'string' },
  { name: 'pressureOverload', start: 106, end: 107, type: 'string' },
  { name: 'massOverload', start: 107, end: 108, type: 'string' },
  { name: 'valveOverload', start: 108, end: 109, type: 'string' },
  { name: 'excitationOverload', start: 109, end: 110, type: 'string' },
  { name: 'stackingFold', start: 110, end: 112, type: 'integer' },
  { name: 'computationDomain', start: 112, end: 113, type: 'string' },
  { name: 've432Version', start: 113, end: 117, type: 'string' },
  { name: 'dayOfYear', start: 117, end: 120, type: 'integer' },
  { name: 'timeHhmmss', start: 120, end: 126, type: 'string' },
  { name: 'hdop', start: 126, end: 130, type: 'float' },
  { name: 'tbDate', start: 130, end: 150, type: 'string' },
  { name: 'gpgga', start: 150, end: 349, type: 'string' },
];

const parseNumber = (str: string, type: 'integer' | 'float'): number | null => {
  const trimmed = str.trim();
  if (trimmed === '') return null;
  const num = type === 'integer' ? parseInt(trimmed, 10) : parseFloat(trimmed);
  return isNaN(num) ? null : num;
};

const getVibratorId = (record: Partial<VibrationRecord>): string | null => {
    if (!record) return null;
    const vibNum = record.vibratorNumber;
    return (vibNum !== null && vibNum !== undefined) ? `v${vibNum}` : null;
}

export const parseAndAnalyzeVibrationData = (fileContent: string): { result: VibrationAnalysisResult | null, rawRecords: VibrationRecord[], totalLines: number, conflictedShotDetails: { shotNb: number, vibrators: string[] }[] } => {
    const lines = fileContent.split('\n');
    const dataLines = lines.filter(line => line.startsWith('A') && line.length > 120);
    const totalVibrationLines = dataLines.length;

    let parsedRecords: VibrationRecord[] = [];
    dataLines.forEach((line, index) => {
        const rawRecord: { [key: string]: any } = { 
            id: `${index}-${line.substring(1, 25).trim()}`,
            lineNumber: index + 1
        };
        
        fieldDefinitions.forEach(field => {
            const valueStr = line.substring(field.start, field.end);
            rawRecord[field.name] = (field.type === 'string')
                ? (valueStr.trim() === '' ? null : valueStr.trim())
                : parseNumber(valueStr, field.type as 'integer' | 'float');
        });

        const record = rawRecord as VibrationRecord;
        record.vibratorId = getVibratorId(record);
        
        record.hasGpsData = record.vibPositionEasting !== null && record.vibPositionNorthing !== null && record.vibPositionEasting !== 0 && record.vibPositionNorthing !== 0 && !!record.gpgga;
        const overloadFields: (keyof VibrationRecord)[] = ['forceOverload', 'pressureOverload', 'massOverload', 'valveOverload', 'excitationOverload'];
        record.hasOverload = overloadFields.some(field => record[field] && (record[field] as string).trim() !== '');
        const warningFields: (keyof VibrationRecord)[] = ['mass1Warning', 'mass2Warning', 'mass3Warning', 'plate1Warning', 'plate2Warning', 'plate3Warning', 'plate4Warning', 'plate5Warning', 'plate6Warning'];
        record.hasWarning = warningFields.some(field => record[field] && (record[field] as string).trim() !== '');
        
        if (record.hasOverload) record.status = 'overload';
        else if (record.hasWarning) record.status = 'warning';
        else record.status = 'ok';
        
        parsedRecords.push(record);
    });

    parsedRecords = calculateSlopeAndAspect(parsedRecords);

    const shotToVibratorsMap = new Map<number, Set<string>>();
    parsedRecords.forEach(record => {
        if (record.shotNb != null && record.vibratorId) {
            if (!shotToVibratorsMap.has(record.shotNb)) {
                shotToVibratorsMap.set(record.shotNb, new Set());
            }
            shotToVibratorsMap.get(record.shotNb)!.add(record.vibratorId);
        }
    });

    const conflictedShotDetails: { shotNb: number; vibrators: string[] }[] = [];
    shotToVibratorsMap.forEach((vibrators, shotNb) => {
        if (vibrators.size > 1) {
            conflictedShotDetails.push({ shotNb, vibrators: Array.from(vibrators).sort((a,b) => getNumericId(a) - getNumericId(b)) });
        }
    });
    conflictedShotDetails.sort((a, b) => a.shotNb - b.shotNb);
    
    const lastLineOfOperation = new Map<string, number>();
    parsedRecords.forEach((record, index) => {
        if (record.shotNb && record.vibratorId) {
            const uniqueKey = `${record.shotNb}-${record.vibratorId}`;
            lastLineOfOperation.set(uniqueKey, index);
        }
    });

    const processedVibroData: VibrationAnalysisResult = {};
    const firstTimeOverall = new Map<string, Date>();
    const lastTimeOverall = new Map<string, Date>();
    
    parsedRecords.forEach(record => {
        if (!record.vibratorId) return;
        const gpggaMatch = record.gpgga?.match(/(\$GPGGA),(\d{6}(?:\.\d{1,})?)/);
        if (gpggaMatch && gpggaMatch[2]) {
            try {
                const timeStr = gpggaMatch[2];
                const hours = parseInt(timeStr.substring(0, 2), 10);
                const minutes = parseInt(timeStr.substring(2, 4), 10);
                const secondsFull = parseFloat(timeStr.substring(4));
                const seconds = Math.floor(secondsFull);
                const milliseconds = Math.round((secondsFull - seconds) * 1000);
                const currentTime = new Date(1970, 0, 1, hours, minutes, seconds, milliseconds);

                if (!firstTimeOverall.has(record.vibratorId) || currentTime < firstTimeOverall.get(record.vibratorId)!) {
                    firstTimeOverall.set(record.vibratorId, currentTime);
                }
                if (!lastTimeOverall.has(record.vibratorId) || currentTime > lastTimeOverall.get(record.vibratorId)!) {
                    lastTimeOverall.set(record.vibratorId, currentTime);
                }
            } catch(e) {
                 console.warn("Could not parse time in pre-pass", e);
            }
        }
    });

    parsedRecords.forEach((record, index) => {
        if (!record.vibratorId) return;

        const uniqueKey = record.shotNb ? `${record.shotNb}-${record.vibratorId}` : null;
        const isDuplicate = uniqueKey ? (index !== lastLineOfOperation.get(uniqueKey)) : true;
        
        const gpggaMatch = record.gpgga?.match(/(\$GPGGA),(\d{6}(?:\.\d{1,})?)/);
        
        if (!processedVibroData[record.vibratorId]) {
            processedVibroData[record.vibratorId] = {
                count: 0, net_count: 0, times: [],
                first_time_net: null, last_time_net: null,
                first_time_total: firstTimeOverall.get(record.vibratorId) || null,
                last_time_total: lastTimeOverall.get(record.vibratorId) || null,
                duplicates: 0,
                duration_seconds_net: 0, duration_seconds_total: 0,
                multi_vib_shots: 0,
            };
        }
        
        const data = processedVibroData[record.vibratorId];
        data.count++;

        if (isDuplicate || !gpggaMatch || !gpggaMatch[2] || record.gpgga?.includes('$ERROR')) {
            data.duplicates++;
        } else {
             try {
                const timeStr = gpggaMatch[2];
                const hours = parseInt(timeStr.substring(0, 2), 10);
                const minutes = parseInt(timeStr.substring(2, 4), 10);
                const secondsFull = parseFloat(timeStr.substring(4));
                const seconds = Math.floor(secondsFull);
                const milliseconds = Math.round((secondsFull - seconds) * 1000);
                const dateObj = new Date(1970, 0, 1, hours, minutes, seconds, milliseconds);

                data.net_count++;
                data.times.push(dateObj);

                if (!data.first_time_net || dateObj < data.first_time_net) {
                    data.first_time_net = dateObj;
                }
                if (!data.last_time_net || dateObj > data.last_time_net) {
                    data.last_time_net = dateObj;
                }
            } catch (e) {
                console.warn(`Error parsing time for line ${index + 1}`);
                data.duplicates++;
            }
        }
    });
    
    for (const vibroId in processedVibroData) {
        const data = processedVibroData[vibroId];
        if (data.last_time_net && data.first_time_net) {
            data.duration_seconds_net = (data.last_time_net.getTime() - data.first_time_net.getTime()) / 1000;
        }
        if (data.last_time_total && data.first_time_total) {
            data.duration_seconds_total = (data.last_time_total.getTime() - data.first_time_total.getTime()) / 1000;
        }
    }
    
    conflictedShotDetails.forEach(conflict => {
        conflict.vibrators.forEach(vibId => {
            if (processedVibroData[vibId]) {
                processedVibroData[vibId].multi_vib_shots++;
            }
        });
    });

    if (Object.keys(processedVibroData).length === 0) {
        return { result: null, rawRecords: [], totalLines: 0, conflictedShotDetails: [] };
    }

    return { result: processedVibroData, rawRecords: parsedRecords, totalLines: totalVibrationLines, conflictedShotDetails };
};

export const parseSpsData = (fileContent: string): SpsPoint[] => {
    const lines = fileContent.split('\n').filter(line => line.trim() !== '');
    const points: SpsPoint[] = [];

    for (const line of lines) {
         try {
            const parts = line.trim().split(/\s+/);
            if (parts.length < 5) continue;
            let x: number, y: number, z: number;
            const pLen = parts.length;
            const lastVal = parseFloat(parts[pLen - 1]);
            const secondLastVal = parseFloat(parts[pLen - 2]);

            if (secondLastVal < 1000000 && lastVal > 1000000) {
                x = secondLastVal; y = lastVal; z = 0.0;
            } else {
                x = parseFloat(parts[pLen - 3]); y = secondLastVal; z = lastVal;
            }

            const station = parseFloat(parts[parts[0].toUpperCase() === 'S' ? 2 : 1]);
            const lineNum = parseFloat(parts[parts[0].toUpperCase() === 'S' ? 1 : 2]);

            if ([station, lineNum, x, y, z].some(isNaN)) continue;
        
            points.push({ id: `L${lineNum}-S${station}`, station, line: lineNum, x, y, z, difficulty: 0 });
        } catch (e) { console.warn("Skipping malformed SPS line:", line, e); }
    }

    if (points.length > 1) {
        const elevationChanges: number[] = [];
        for (let i = 0; i < points.length; i++) {
            const prevPoint = points[i-1];
            const nextPoint = points[i+1];
            let elevationChange = 0;
            if(prevPoint && nextPoint && prevPoint.line === points[i].line && nextPoint.line === points[i].line) {
                elevationChange = Math.abs(nextPoint.z - prevPoint.z);
            } else if (nextPoint && nextPoint.line === points[i].line) {
                elevationChange = Math.abs(nextPoint.z - points[i].z);
            }
            points[i].difficulty = elevationChange;
            if (elevationChange > 0) elevationChanges.push(elevationChange);
        }

        const maxChange = Math.max(...elevationChanges);
        if (maxChange > 0) {
            for (let i = 0; i < points.length; i++) {
                points[i].difficulty = points[i].difficulty / maxChange;
            }
        }
    }
    
    return points;
};

const calculateVibratorPerformance = (analysisResult: VibrationAnalysisResult): SummaryIndividual[] => {
    const performances = Object.entries(analysisResult).map(([vibro_id, info]) => {
        const netProductivity = info.net_count;
        const totalDurationHours = info.duration_seconds_total / 3600;
        const performance = totalDurationHours > 0 ? netProductivity / totalDurationHours : 0;
        return {
            vibro_id,
            count: info.count,
            net_count: info.net_count,
            duplicates: info.duplicates,
            dup_perc: info.count > 0 ? (info.duplicates / info.count * 100) : 0,
            first_time: info.first_time_total?.toLocaleTimeString('en-GB') || 'N/A',
            last_time: info.last_time_total?.toLocaleTimeString('en-GB') || 'N/A',
            duration_total: formatDuration(info.duration_seconds_total),
            multi_vib_shots: info.multi_vib_shots,
            efficiencyScore: performance
        };
    });

    const maxPerformance = Math.max(...performances.map(p => p.efficiencyScore));
    if (maxPerformance > 0) {
        performances.forEach(p => {
            p.efficiencyScore = (p.efficiencyScore / maxPerformance) * 100;
        });
    }
    return performances.sort((a, b) => getNumericId(a.vibro_id) - getNumericId(b.vibro_id));
};


export const generateSummary = (
    analysisResult: VibrationAnalysisResult, 
    fileName: string, 
    totalVibrationLines: number,
    conflictedShotDetails: { shotNb: number, vibrators: string[] }[]
): SummaryData => {
    const totalDuplicates = Object.values(analysisResult).reduce((sum, d) => sum + d.duplicates, 0);
    const netOperations = Object.values(analysisResult).reduce((sum, d) => sum + d.net_count, 0);
    const totalOperationDurationSeconds = Object.values(analysisResult).reduce((sum, d) => sum + d.duration_seconds_total, 0);

    const individualPerformance = calculateVibratorPerformance(analysisResult);

    return {
        timestamp: new Date().toLocaleString(),
        source_file: fileName,
        general_summary: {
            total_vibros: Object.keys(analysisResult).length,
            total_operations: totalVibrationLines,
            total_duplicates: totalDuplicates,
            net_operations: netOperations,
            duplicate_percentage: totalVibrationLines > 0 ? (totalDuplicates / totalVibrationLines * 100) : 0,
            total_operation_duration_str: formatDuration(totalOperationDurationSeconds),
            conflicted_shot_details: conflictedShotDetails
        },
        individual_performance: individualPerformance
    };
};

// --- K-Means Clustering for Task Planning ---
const euclideanDistance = (p1: SpsPoint, p2: {x: number, y: number}): number => {
    return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
};

const kmeans = (points: SpsPoint[], k: number): SpsPoint[][] => {
    if (k <= 0 || k > points.length) return [points];

    // 1. Initialize centroids randomly
    let centroids = points.slice(0, k).map(p => ({ x: p.x, y: p.y }));

    let assignments: number[] = [];
    let changed = true;
    const maxIterations = 50;
    let iterations = 0;

    while (changed && iterations < maxIterations) {
        changed = false;
        iterations++;
        // 2. Assignment step
        const newAssignments = points.map(point => {
            let minDistance = Infinity;
            let clusterIndex = 0;
            centroids.forEach((centroid, i) => {
                const distance = euclideanDistance(point, centroid);
                if (distance < minDistance) {
                    minDistance = distance;
                    clusterIndex = i;
                }
            });
            return clusterIndex;
        });

        if (assignments.toString() !== newAssignments.toString()) {
            changed = true;
            assignments = newAssignments;
        } else {
            changed = false;
        }

        // 3. Update step
        const newCentroids = Array.from({ length: k }, () => ({ x: 0, y: 0, count: 0 }));
        points.forEach((point, i) => {
            const clusterIndex = assignments[i];
            newCentroids[clusterIndex].x += point.x;
            newCentroids[clusterIndex].y += point.y;
            newCentroids[clusterIndex].count++;
        });

        centroids = newCentroids.map(c => ({
            x: c.count > 0 ? c.x / c.count : 0,
            y: c.count > 0 ? c.y / c.count : 0
        }));
    }

    // Group points into clusters
    const clusters: SpsPoint[][] = Array.from({ length: k }, () => []);
    points.forEach((point, i) => {
        clusters[assignments[i]].push(point);
    });

    return clusters.filter(c => c.length > 0);
};

// Fix: Use FeatureCollection and Polygon types and remove turf. prefix from function calls
export const generateTaskPlan = (tasks: SpsPoint[], vibrators: SummaryIndividual[], noGoZones?: FeatureCollection<Polygon>): SpsPoint[] => {
    try {
        const k = vibrators.length;
        if (k === 0 || tasks.length === 0) return tasks;

        let availableTasks = tasks;
        if (noGoZones && noGoZones.features.length > 0) {
            availableTasks = tasks.filter(task => {
                const taskPoint = point([(task as any).location.lon, (task as any).location.lat]);
                for (const zone of noGoZones.features) {
                    if (booleanPointInPolygon(taskPoint, zone)) {
                        return false; // Exclude task if it's in a no-go zone
                    }
                }
                return true;
            });
        }

        const clusters = kmeans(availableTasks, k);
        const sortedVibrators = [...vibrators].sort((a, b) => b.efficiencyScore - a.efficiencyScore);
        const assignments: SpsPoint[] = [];
        clusters.forEach((cluster, index) => {
            const vibrator = sortedVibrators[index % k];
            if (vibrator) {
                cluster.forEach(task => {
                    assignments.push({ ...task, assignedVibrator: vibrator.vibro_id });
                });
            }
        });

        // Group tasks by assigned vibrator to create optimized paths for each
        const tasksByVibrator: { [key: string]: SpsPoint[] } = {};
        assignments.forEach(task => {
            if (!task.assignedVibrator) return;
            if (!tasksByVibrator[task.assignedVibrator]) {
                tasksByVibrator[task.assignedVibrator] = [];
            }
            tasksByVibrator[task.assignedVibrator].push(task);
        });

        const finalOrderedPlan: SpsPoint[] = [];
        // Process each vibrator's tasks independently with optimized pathing
        Object.keys(tasksByVibrator).sort((a, b) => getNumericId(a) - getNumericId(b)).forEach(vibId => {
            const vibTasks = tasksByVibrator[vibId];
            // Group tasks by line to handle them sequentially
            const tasksByLine: { [key: number]: SpsPoint[] } = {};
            vibTasks.forEach(task => {
                if (!tasksByLine[task.line]) {
                    tasksByLine[task.line] = [];
                }
                tasksByLine[task.line].push(task);
            });

            const sortedLineNumbers = Object.keys(tasksByLine).map(Number).sort((a, b) => a - b);
            
            let isReverse = false;
            sortedLineNumbers.forEach(lineNumber => {
                let lineTasks = tasksByLine[lineNumber];
                // Always sort by station ascending first to establish a baseline order
                lineTasks.sort((a, b) => a.station - b.station);
                
                if (isReverse) {
                    lineTasks.reverse(); // Reverse the order for the snake pattern
                }
                finalOrderedPlan.push(...lineTasks);
                isReverse = !isReverse; // Flip the direction for the next line
            });
        });

        return finalOrderedPlan;
    } catch (err) {
        console.error('generateTaskPlan failed:', err);
        return [];
    }
};


export const generateExportText = (summaryData: SummaryData): string => {
    let content = `VIBRATION ANALYSIS SUMMARY - ${summaryData.timestamp}\n`;
    content += `Source File: ${summaryData.source_file}\n`;
    content += "=".repeat(120) + "\n\n";

    const gs = summaryData.general_summary;
    content += " GENERAL SUMMARY\n";
    content += "-".repeat(40) + "\n";
    content += `${'Total Vibrators:'.padEnd(35)} ${gs.total_vibros}\n`;
    content += `${'Total Raw Operations:'.padEnd(35)} ${gs.total_operations}\n`;
    content += `${'Total Duplicates/Errors Removed:'.padEnd(35)} ${gs.total_duplicates}\n`;
    content += `${'Net Operations:'.padEnd(35)} ${gs.net_operations}\n`;
    content += `${'Duplicate Percentage:'.padEnd(35)} ${gs.duplicate_percentage.toFixed(2)}%\n`;
    content += `${'Total Operation Duration:'.padEnd(35)} ${gs.total_operation_duration_str}\n`;
    content += `${'Multi-Vibrator Shots (Conflicts):'.padEnd(35)} ${gs.conflicted_shot_details.length}\n\n`;

    content += " INDIVIDUAL VIBRATOR PERFORMANCE\n";
    const header = `| ${'Vibrator ID'.padEnd(12)} | ${'Total'.padStart(8)} | ${'Net'.padStart(8)} | ${'Dups'.padStart(8)} | ${'Dup %'.padStart(7)} | ${'Conflicts'.padStart(10)} | ${'First Time'.padStart(10)} | ${'Last Time'.padStart(10)} | ${'Duration'.padStart(10)} |`;
    content += "-".repeat(header.length) + "\n";
    content += header + "\n";
    content += "-".repeat(header.length) + "\n";

    for (const perf of summaryData.individual_performance) {
        const row = `| ${perf.vibro_id.padEnd(12)} | ${String(perf.count).padStart(8)} | ${String(perf.net_count).padStart(8)} | ${String(perf.duplicates).padStart(8)} | ${perf.dup_perc.toFixed(1).padStart(7)} | ${String(perf.multi_vib_shots).padStart(10)} | ${perf.first_time.padStart(10)} | ${perf.last_time.padStart(10)} | ${perf.duration_total.padStart(10)} |`;
        content += row + "\n";
    }
    content += "-".repeat(header.length) + "\n\n";

    if (gs.conflicted_shot_details.length > 0) {
        content += " MULTI-VIBRATOR SHOT (CONFLICT) DETAILS\n";
        content += "-".repeat(53) + "\n";
        content += `| ${'Shot Number'.padEnd(15)} | ${'Vibrators Involved'.padEnd(30)} |\n`;
        content += `|-${'-'.repeat(15)}-|-${'-'.repeat(30)}-|\n`;
        for (const conflict of gs.conflicted_shot_details) {
            content += `| ${String(conflict.shotNb).padEnd(15)} | ${conflict.vibrators.join(', ').padEnd(30)} |\n`;
        }
        content += "-".repeat(53) + "\n";
    }

    return content;
};