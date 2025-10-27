
import { VibrationRecord } from '../types';
import { point, featureCollection } from '@turf/helpers';

// Calculates the distance between two records in meters
const haversineDistance = (rec1: VibrationRecord, rec2: VibrationRecord): number => {
    if (rec1.vibPositionEasting === null || rec1.vibPositionNorthing === null || rec2.vibPositionEasting === null || rec2.vibPositionNorthing === null) {
        return Infinity;
    }
    const dx = rec1.vibPositionEasting - rec2.vibPositionEasting;
    const dy = rec1.vibPositionNorthing - rec2.vibPositionNorthing;
    return Math.sqrt(dx * dx + dy * dy);
};

export const calculateSlopeAndAspect = (records: VibrationRecord[]): VibrationRecord[] => {
    if (records.length < 3) {
        return records;
    }

    const recordsWithGps = records.filter(r => r.hasGpsData && r.vibPositionElevation != null);

    // For performance, create a spatial index (simple grid for this case)
    const grid: { [key: string]: VibrationRecord[] } = {};
    const gridSize = 100; // 100m grid cells

    recordsWithGps.forEach(r => {
        const gridX = Math.floor(r.vibPositionEasting! / gridSize);
        const gridY = Math.floor(r.vibPositionNorthing! / gridSize);
        const key = `${gridX},${gridY}`;
        if (!grid[key]) {
            grid[key] = [];
        }
        grid[key].push(r);
    });

    const getNeighbors = (record: VibrationRecord): VibrationRecord[] => {
        const gridX = Math.floor(record.vibPositionEasting! / gridSize);
        const gridY = Math.floor(record.vibPositionNorthing! / gridSize);
        const neighbors: VibrationRecord[] = [];
        for (let i = -1; i <= 1; i++) {
            for (let j = -1; j <= 1; j++) {
                const key = `${gridX + i},${gridY + j}`;
                if (grid[key]) {
                    neighbors.push(...grid[key]);
                }
            }
        }
        return neighbors
            .filter(n => n.id !== record.id)
            .sort((a, b) => haversineDistance(record, a) - haversineDistance(record, b))
            .slice(0, 8); // Get up to 8 nearest neighbors
    };
    

    const recordMap = new Map<string, VibrationRecord>(records.map(r => [r.id, r]));

    recordsWithGps.forEach(record => {
        const neighbors = getNeighbors(record);
        if (neighbors.length < 2) {
            record.slope = 0;
            record.aspect = -1;
            return;
        }

        const points = [record, ...neighbors].map(r => 
            point([r.vibPositionEasting!, r.vibPositionNorthing!], { elevation: r.vibPositionElevation! })
        );
        const collection = featureCollection(points);
        
        // Fit a plane to the points: z = ax + by + c
        // Using linear regression to solve for a and b
        const n = points.length;
        let sumX = 0, sumY = 0, sumZ = 0, sumXX = 0, sumYY = 0, sumXY = 0, sumXZ = 0, sumYZ = 0;

        for (const p of points) {
            const x = p.geometry.coordinates[0];
            const y = p.geometry.coordinates[1];
            const z = p.properties.elevation;
            sumX += x; sumY += y; sumZ += z;
            sumXX += x * x; sumYY += y * y; sumXY += x * y;
            sumXZ += x * z; sumYZ += y * z;
        }

        const A = [
            [sumXX, sumXY, sumX],
            [sumXY, sumYY, sumY],
            [sumX, sumY, n]
        ];
        const B = [sumXZ, sumYZ, sumZ];

        // Solve Ax = B for x = [a, b, c]
        // Simplified by assuming the plane passes through the centroid
        const meanX = sumX / n;
        const meanY = sumY / n;
        const meanZ = sumZ / n;

        let Sxx = 0, Syy = 0, Sxy = 0, Sxz = 0, Syz = 0;
        for (const p of points) {
            const x = p.geometry.coordinates[0];
            const y = p.geometry.coordinates[1];
            const z = p.properties.elevation;
            Sxx += (x - meanX) * (x - meanX);
            Syy += (y - meanY) * (y - meanY);
            Sxy += (x - meanX) * (y - meanY);
            Sxz += (x - meanX) * (z - meanZ);
            Syz += (y - meanY) * (z - meanZ);
        }

        const det = Sxx * Syy - Sxy * Sxy;
        if (Math.abs(det) < 1e-9) {
            record.slope = 0;
            record.aspect = -1;
            return;
        }

        const dz_dx = (Syy * Sxz - Sxy * Syz) / det; // 'a' coefficient
        const dz_dy = (Sxx * Syz - Sxy * Sxz) / det; // 'b' coefficient

        // Slope is the magnitude of the gradient
        const slopeRad = Math.atan(Math.sqrt(dz_dx * dz_dx + dz_dy * dz_dy));
        const slopeDeg = slopeRad * (180 / Math.PI);

        // Aspect is the direction of the gradient
        const aspectRad = Math.atan2(-dz_dx, dz_dy);
        let aspectDeg = aspectRad * (180 / Math.PI);
        if (aspectDeg < 0) {
            aspectDeg += 360;
        }

        const originalRecord = recordMap.get(record.id);
        if (originalRecord) {
            originalRecord.slope = slopeDeg;
            originalRecord.aspect = aspectDeg;
        }
    });

    return Array.from(recordMap.values());
};
