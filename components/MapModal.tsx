import React, { useState, useRef, useEffect, useMemo, useContext, useCallback } from 'react';
import L from 'leaflet';
(window as any).L = L;
import "leaflet.markercluster/dist/leaflet.markercluster.js";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import "leaflet-draw";
import {
  ChevronLeft,
  SlidersHorizontal,
  X,
  AlertTriangle,
  Menu,
  Sparkles,
  Download,
  Users,
  Briefcase,
  BarChart2,
  Compass,
  Trash2,
  Route,
  Palette,
  Eye,
  CheckSquare,
  Square,
  Database,
  LandPlot,
  Ruler,
  Ban,
  Orbit,
  Mountain,
  Grid3x3,
} from "lucide-react";
import { GeoSearchControl, OpenStreetMapProvider } from "leaflet-geosearch";
import * as utm from "utm";
import maplibregl from "maplibre-gl";

// Fix: Import turf functions and types explicitly
import { featureCollection } from '@turf/turf';
import type { FeatureCollection, Polygon } from 'geojson';
import { Delaunay } from 'd3-delaunay';

import { ThemeColors, VibrationPointDetail, VibrationRecord, SpsPoint, SummaryData, VibrationPointStatus } from '../types';
import { useI18n, I18nContext } from '../hooks/useI18n';
import { generateTaskPlan, getNumericId } from '../services/analyzer';
import { MaplibreLayer } from '@maplibre/maplibre-gl-leaflet';
import '@geoman-io/leaflet-geoman-free';


// Leaflet Icon fix
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// CSS Overrides
const getLeafletCssOverrides = (theme: ThemeColors) => `
  .custom-popup .leaflet-popup-content-wrapper { background-color: var(--color-bg-primary) !important; backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); background-opacity: 0.8; box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37) !important; border: 1px solid var(--color-border) !important; border-radius: 8px; }
  .custom-popup .leaflet-popup-tip { background: var(--color-bg-primary) !important; }
  .custom-popup .leaflet-popup-content { margin: 0 !important; }
  .custom-popup .leaflet-container a.leaflet-popup-close-button { display: none !important; }
  .leaflet-bar a.search-button, .leaflet-bar a.reset { background-color: var(--color-bg-primary) !important; border-color: var(--color-border) !important; color: var(--color-text-primary) !important; }
  .leaflet-bar a.search-button:hover, .leaflet-bar a.reset:hover { background-color: var(--color-bg-tertiary) !important; }
  .leaflet-draw-toolbar a { background-color: var(--color-bg-primary) !important; border-color: var(--color-border) !important; }
  .leaflet-draw-toolbar a:hover { background-color: var(--color-bg-tertiary) !important; }
  .marker-cluster { border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; color: white; text-shadow: 1px 1px 2px rgba(0,0,0,0.5); }
  .marker-cluster-ok { background-color: ${theme.accent_secondary}BF; border: 2px solid ${theme.accent_secondary}; }
  .marker-cluster-warning { background-color: ${theme.warning}BF; border: 2px solid ${theme.warning}; }
  .marker-cluster-overload { background-color: ${theme.overload}BF; border: 2px solid ${theme.overload}; }
  .vaps-tooltip, .cluster-tooltip { background-color: ${theme.bg_tertiary} !important; border: 1px solid ${theme.border} !important; color: ${theme.text_primary} !important; box-shadow: 0 1px 3px rgba(0,0,0,0.4) !important; border-radius: 4px; padding: 6px !important; font-size: 12px; }
  .vaps-tooltip .status-ok, .cluster-tooltip .status-ok { color: ${theme.accent_secondary}; font-weight: bold; }
  .vaps-tooltip .status-warning, .cluster-tooltip .status-warning { color: ${theme.warning}; font-weight: bold; }
  .vaps-tooltip .status-overload, .cluster-tooltip .status-overload { color: ${theme.overload}; font-weight: bold; }
`;


const convertDMToDD = (degreesMinutes: string, direction: 'N' | 'S' | 'E' | 'W'): number => {
    const isLat = direction === 'N' || direction === 'S';
    const degreesPartIndex = isLat ? 2 : 3;
    if (degreesMinutes.length < degreesPartIndex + 2) return NaN;
    const degreesPart = parseInt(degreesMinutes.slice(0, degreesPartIndex), 10);
    const minutesPart = parseFloat(degreesMinutes.slice(degreesPartIndex));
    if (isNaN(degreesPart) || isNaN(minutesPart)) return NaN;
    let dd = degreesPart + minutesPart / 60;
    if (direction === 'S' || direction === 'W') { dd *= -1; }
    return dd;
};

const interpolateLatLngs = (latlngs: L.LatLng[], progress: number): L.LatLng | null => {
    if (!latlngs || latlngs.length < 2) return latlngs?.[0] || null;

    const totalDistances: number[] = [0];
    let totalLength = 0;
    for (let i = 0; i < latlngs.length - 1; i++) {
        const dist = latlngs[i].distanceTo(latlngs[i+1]);
        totalLength += dist;
        totalDistances.push(totalLength);
    }

    if (totalLength === 0) return latlngs[0];

    const targetDistance = progress * totalLength;
    
    if (targetDistance <= 0) return latlngs[0];
    if (targetDistance >= totalLength) return latlngs[latlngs.length - 1];

    let segmentIndex = 0;
    for (let i = 0; i < totalDistances.length - 1; i++) {
        if (targetDistance >= totalDistances[i] && targetDistance <= totalDistances[i+1]) {
            segmentIndex = i;
            break;
        }
    }
    
    const startPoint = latlngs[segmentIndex];
    const endPoint = latlngs[segmentIndex + 1];
    const segmentLength = totalDistances[segmentIndex + 1] - totalDistances[segmentIndex];
    const distanceIntoSegment = targetDistance - totalDistances[segmentIndex];
    
    if (segmentLength < 1e-6) return startPoint;

    const ratio = distanceIntoSegment / segmentLength;
    const lat = startPoint.lat + (endPoint.lat - startPoint.lat) * ratio;
    const lng = startPoint.lng + (endPoint.lng - startPoint.lng) * ratio;
    
    return L.latLng(lat, lng);
};

// ... Popup Component (can be simplified if not needed for SPS points)

const MapModal: React.FC<{ isOpen: boolean; onClose: () => void; rawRecords: VibrationRecord[]; spsPoints: SpsPoint[], theme: ThemeColors; summaryData: SummaryData | null; }> = ({ isOpen, onClose, rawRecords, spsPoints, theme, summaryData }) => {
    const { t, language } = useI18n();
    const [mapState, setMapState] = useState<'loading' | 'ready' | 'error'>('loading');
    const [vapsPointsDetails, setVapsPointsDetails] = useState<VibrationPointDetail[]>([]);
    const [spsPointsWithCoords, setSpsPointsWithCoords] = useState<SpsPoint[]>([]);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    
    useEffect(() => {
        if (isOpen) {
            setMapState('loading');
            setTimeout(() => {
                try {
                    const vapsDetails: VibrationPointDetail[] = rawRecords.flatMap(record => {
                        const gpggaMatch = record.gpgga?.match(/\$GPGGA,(\d{6}(?:\.\d{1,})?),(\d{4}\.\d+),([NS]),(\d{5}\.\d+),([EW]),\d,\d+,[\d\.]+,([\d\.-]+)/);
                        if (!record.vibratorId || !gpggaMatch) return [];
                        const lat = convertDMToDD(gpggaMatch[2], gpggaMatch[3] as 'N' | 'S');
                        const lon = convertDMToDD(gpggaMatch[4], gpggaMatch[5] as 'E' | 'W');
                        if (isNaN(lat) || isNaN(lon)) return [];
                        const timeStr = gpggaMatch[1];
                        const time = new Date(1970, 0, 1, parseInt(timeStr.substring(0, 2)), parseInt(timeStr.substring(2, 4)), parseInt(timeStr.substring(4, 6)));
                        return [{
                            id: record.id, vibroId: record.vibratorId, time, location: { lat, lon, elevation: parseFloat(gpggaMatch[6]) }, status: record.status,
                            line: record.lineName || '', point: record.pointNumber || '', shotNb: record.shotNb?.toString() || '',
                            avgForce: record.averageForce?.toString() || '0', avgPhase: record.averagePhase?.toString() || '0', avgDist: record.averageDistortion?.toString() || '0',
                            duplicateVibrators: record.duplicateVibrators, slope: record.slope
                        }];
                    });
                    setVapsPointsDetails(vapsDetails);

                    // WARNING: Assumes UTM zone 31N. Should be configurable for production.
                    const zone = 31; 
                    const spsWithCoords = spsPoints.map(p => {
                        try {
                            const latlon = utm.toLatLon(p.x, p.y, zone, 'N');
                            return { ...p, location: { lat: latlon.latitude, lon: latlon.longitude, elevation: p.z }};
                        } catch(e) {
                            console.warn(`Could not convert UTM for SPS point ${p.id}`, e);
                            return null;
                        }
                    }).filter((p): p is SpsPoint & { location: { lat: number, lon: number, elevation: number }} => p !== null);
                    setSpsPointsWithCoords(spsWithCoords);

                    if (vapsDetails.length === 0 && spsWithCoords.length === 0) { throw new Error(t('noGpsData')); }
                    setMapState('ready');
                } catch (e) { 
                    const error = e as Error;
                    console.error("Error preparing map data:", error); 
                    setErrorMessage(error.message || t('mapDataError')); 
                    setMapState('error'); 
                }
            }, 50);
        }
    }, [isOpen, rawRecords, spsPoints, t]);
  
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-bg-primary z-40">
            <style>{getLeafletCssOverrides(theme)}</style>
            <div className="w-full h-full relative">
                {mapState === 'ready' && (
                    <MapController
                       center={[28.0339, 1.6596]} zoom={6} scrollWheelZoom={true} maxZoom={22}
                       vapsPoints={vapsPointsDetails}
                       spsPoints={spsPointsWithCoords}
                       summaryData={summaryData}
                       theme={theme}
                    />
                )}
                {mapState !== 'ready' && (
                    <div className="absolute inset-0 z-[1001] flex flex-col items-center justify-center bg-bg-primary/90 backdrop-blur-sm gap-4 text-text-primary p-4 text-center">
                        {mapState === 'loading' && <div className="w-12 h-12 border-4 border-t-accent-primary border-transparent rounded-full animate-spin"></div>}
                        {mapState === 'error' && <AlertTriangle size={48} className="text-yellow-400" />}
                        <p className="text-xl">{mapState === 'loading' ? t('generatingStatus') : errorMessage}</p>
                    </div>
                )}
                <button
                    onClick={onClose}
                    className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1001] bg-accent-primary text-white font-bold py-2 px-8 rounded-full shadow-lg hover:opacity-90 hover:translate-y-0 transition-[box-shadow,opacity,transform]"
                >
                    {t('returnToProgramInterface')}
                </button>
            </div>
        </div>
    );
};

const MapController: React.FC<any> = ({ vapsPoints, spsPoints, summaryData, theme, ...rest }) => {
    const [map, setMap] = useState<L.Map | null>(null);
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<L.Map | null>(null);
    const i18nContextValue = useContext(I18nContext);
    const { t } = useI18n();

    const [mode, setMode] = useState<'analysis' | 'planner'>(spsPoints.length > 0 && summaryData ? 'planner' : 'analysis');

    // Analysis State
    const [statusFilters, setStatusFilters] = useState({ ok: true, warning: true, overload: true });
    const [activeVibratorId, setActiveVibratorId] = useState<string | null>(null);

    const vibratorSummaries = useMemo(() => {
      const summaries = new Map<string, { count: number }>();
      (vapsPoints || []).forEach((p: VibrationPointDetail) => {
        const s = summaries.get(p.vibroId) || { count: 0 };
        s.count++;
        summaries.set(p.vibroId, s);
      });
      return summaries;
    }, [vapsPoints]);

    const sortedVibrators = useMemo(() => Array.from(vibratorSummaries.keys()).sort((a, b) => getNumericId(a) - getNumericId(b)), [vibratorSummaries]);
    
    const pointsToShow = useMemo(() => {
        let points = vapsPoints || [];
        points = points.filter((p: VibrationPointDetail) => (statusFilters as any)[p.status]);
        if(activeVibratorId) {
            points = points.filter((p: VibrationPointDetail) => p.vibroId === activeVibratorId);
        }
        return points;
    }, [activeVibratorId, statusFilters, vapsPoints]);

    // Planner State
    const [plan, setPlan] = useState<SpsPoint[] | null>(null);
    const [colorMode, setColorMode] = useState<'difficulty' | 'assignment'>('difficulty');
    const [highlightedVibrators, setHighlightedVibrators] = useState<string[]>([]);
    const routeLayerRef = useRef<L.LayerGroup | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    // Fix: Use FeatureCollection and Polygon types, and call featureCollection without turf. prefix
    const [noGoZones, setNoGoZones] = useState<FeatureCollection<Polygon>>(featureCollection([]));


    const vibratorColors = useMemo(() => {
        if (!summaryData) return {};
        const colors = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#C9CBCF', '#E63946', '#F1FAEE', '#A8DADC', '#457B9D', '#1D3557'];
        const colorMap: { [key: string]: string } = {};
        summaryData.individual_performance.forEach((vib: any, index: number) => {
            colorMap[vib.vibro_id] = colors[index % colors.length];
        });
        return colorMap;
    }, [summaryData]);

    const totalVapsPoints = (vapsPoints || []).length;
    const visibleVapsPoints = pointsToShow.length;
    const totalSpsPoints = spsPoints.length;
    const plannedPoints = plan ? plan.length : 0;

    const handleRecenter = useCallback(() => {
        const mapInstance = mapRef.current;
        if (!mapInstance) return;

        if (mode === 'analysis') {
            if (pointsToShow.length === 0) return;
            const bounds = L.latLngBounds(
                pointsToShow.map(point => [point.location.lat, point.location.lon] as [number, number])
            );
            if (bounds.isValid()) {
                mapInstance.flyToBounds(bounds, { padding: [80, 80], maxZoom: 18 });
            }
            return;
        }

        const plannerTargets = (plan && plan.length > 0 ? plan : spsPoints).filter((p: any) => p?.location);
        if (plannerTargets.length === 0) return;
        const plannerBounds = L.latLngBounds(
            plannerTargets.map((p: any) => [p.location.lat, p.location.lon] as [number, number])
        );
        if (plannerBounds.isValid()) {
            mapInstance.flyToBounds(plannerBounds, { padding: [80, 80], maxZoom: 16 });
        }
    }, [mode, plan, pointsToShow, spsPoints]);
    
    useEffect(() => {
        const container = mapContainerRef.current;
        if (!container) return;
        if (mapRef.current) return; // already initialized

        try {
            const mapInstance = L.map(container, { ...rest });
            mapRef.current = mapInstance;

            const baseLayers = {
                [t('satellite')]: L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',{ maxZoom: 22, subdomains:['mt0','mt1','mt2','mt3'] }),
                [t('streetMap')]: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 22 }),
            };
            baseLayers[t('satellite')].addTo(mapInstance);
            L.control.layers(baseLayers).addTo(mapInstance);
            L.control.scale({ imperial: false }).addTo(mapInstance);
            mapInstance.addControl(new (GeoSearchControl as any)({ provider: new OpenStreetMapProvider(), style: 'bar', autoClose: true, searchLabel: t('searchLabelPlaceholder') }));

            (mapInstance as any).pm.addControls({ position: 'topright', drawCircle: false, drawCircleMarker: false, drawMarker: false });
            mapInstance.on('pm:create', (e: any) => {
              if (e.shape === 'Polygon') {
                const geoJson = e.layer.toGeoJSON();
                setNoGoZones(zones => featureCollection([...zones.features, geoJson]));
                e.layer.bindTooltip(t('noGoZone'), {sticky: true}).openTooltip();
              }
            });

            setMap(mapInstance);
        } catch (err) {
            console.error("Failed to initialize map:", err);
        }

        return () => {
            try {
                if (mapRef.current) {
                    mapRef.current.remove();
                    mapRef.current = null;
                    setMap(null);
                }
            } catch (e) {
                console.warn("Error removing map:", e);
            }
        };
    }, []);

    const handleGeneratePlan = () => {
        if (!summaryData || spsPoints.length === 0) return;
        const newPlan = generateTaskPlan(spsPoints, summaryData.individual_performance, noGoZones);
        setPlan(newPlan);
        setColorMode('assignment');
        alert(t('planGenerated'));
    };

    const handleClearPlan = () => {
        setPlan(null);
        setColorMode('difficulty');
        setHighlightedVibrators([]);
    };
    
    const handleExportPlan = () => {
        if (!plan) return;
        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += "Vibrator,Line,Station,Difficulty,Easting,Northing,Elevation\r\n";
        plan.forEach(p => {
            const row = [p.assignedVibrator, p.line, p.station, p.difficulty.toFixed(3), p.x, p.y, p.z].join(",");
            csvContent += row + "\r\n";
        });
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "work_plan.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Effect to draw animated route
    useEffect(() => {
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }
        if (map && routeLayerRef.current) {
            map.removeLayer(routeLayerRef.current);
            routeLayerRef.current = null;
        }

        if (map && highlightedVibrators.length > 0 && plan) {
            const layerGroup = L.layerGroup().addTo(map);
            routeLayerRef.current = layerGroup;

            const animatedRoutes = highlightedVibrators.map(vibId => {
                 const latlngs = plan
                    .filter(p => p.assignedVibrator === vibId)
                    .map(p => L.latLng((p as any).location.lat, (p as any).location.lon));
                
                if (latlngs.length < 2) return null;

                L.polyline(latlngs, {
                    color: vibratorColors[vibId] || theme.text_secondary,
                    weight: 2,
                    opacity: 0.6,
                    dashArray: '5, 10',
                }).addTo(layerGroup);
                
                const luminousIcon = L.divIcon({
                    html: `<div style="background-color: ${vibratorColors[vibId]}; width: 14px; height: 14px; border-radius: 50%; box-shadow: 0 0 12px 4px ${vibratorColors[vibId]}; border: 2px solid #fff;"></div>`,
                    className: '',
                    iconSize: [14, 14],
                });

                const movingMarker = L.marker(latlngs[0], { icon: luminousIcon }).addTo(layerGroup);
                
                let totalDistance = 0;
                for (let i = 0; i < latlngs.length - 1; i++) { totalDistance += latlngs[i].distanceTo(latlngs[i+1]); }
                
                const duration = Math.max(3000, (totalDistance / 500) * 1000); // 500 m/s speed

                return { marker: movingMarker, path: latlngs, duration };
            }).filter(Boolean);

            if (animatedRoutes.length > 0) {
                 let startTime: number | null = null;
                 const animate = (timestamp: number) => {
                    if (!startTime) startTime = timestamp;
                    const elapsed = timestamp - startTime;

                    animatedRoutes.forEach(route => {
                        if (route) {
                            const progress = (elapsed % route.duration) / route.duration;
                            const interpolated = interpolateLatLngs(route.path, progress);
                            if (interpolated) {
                                route.marker.setLatLng(interpolated);
                            }
                        }
                    });
                    
                    animationFrameRef.current = requestAnimationFrame(animate);
                };
                animationFrameRef.current = requestAnimationFrame(animate);
            }
        }
        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [highlightedVibrators, plan, map, theme, vibratorColors]);

    return (
        <div className="w-full h-full relative">
            <div ref={mapContainerRef} className="w-full h-full" />
            {map && (
                <>
                    {mode === 'analysis' && <VapsPointLayer map={map} points={pointsToShow} totalPointsCount={(vapsPoints || []).length} theme={theme} i18nContextValue={i18nContextValue} />}
                    {mode === 'planner' && <SpsPointLayer map={map} spsPoints={plan || spsPoints} colorMode={colorMode} vibratorColors={vibratorColors} theme={theme} highlightedVibrators={highlightedVibrators} />}
                    <ControlPanel 
                        map={map}
                        mode={mode} setMode={setMode} 
                        plan={plan}
                        handleGeneratePlan={handleGeneratePlan}
                        handleClearPlan={handleClearPlan}
                        handleExportPlan={handleExportPlan}
                        summaryData={summaryData}
                        colorMode={colorMode} setColorMode={setColorMode}
                        highlightedVibrators={highlightedVibrators} setHighlightedVibrators={setHighlightedVibrators}
                        spsPoints={spsPoints}
                        vapsPoints={vapsPoints}
                        hasVaps={vapsPoints.length > 0}
                        statusFilters={statusFilters} setStatusFilters={setStatusFilters}
                        activeVibratorId={activeVibratorId} setActiveVibratorId={setActiveVibratorId}
                        sortedVibrators={sortedVibrators} vibratorSummaries={vibratorSummaries}
                        vibratorColors={vibratorColors}
                    />
                    <MapHud
                        mode={mode}
                        colorMode={colorMode}
                        totalVaps={totalVapsPoints}
                        visibleVaps={visibleVapsPoints}
                        totalSps={totalSpsPoints}
                        plannedCount={plannedPoints}
                        summaryData={summaryData}
                        onRecenter={handleRecenter}
                    />
                </>
            )}
        </div>
    );
}

const VapsPointLayer: React.FC<{ map: L.Map; points: VibrationPointDetail[]; totalPointsCount: number; theme: ThemeColors; i18nContextValue: any }> = ({ map, points, totalPointsCount, theme, i18nContextValue }) => {
    const layerRef = useRef<L.MarkerClusterGroup | null>(null);
    const { t } = useI18n();
    const [currentPoints, setCurrentPoints] = useState<VibrationPointDetail[]>([]);

    useEffect(() => {
        // Only update points if they have actually changed, to avoid unnecessary re-renders/re-zooming
        if (JSON.stringify(points) !== JSON.stringify(currentPoints)) {
            setCurrentPoints(points);
        }
    }, [points, currentPoints]);


    useEffect(() => {
        if (!map) return;

        if (layerRef.current) {
            map.removeLayer(layerRef.current);
            layerRef.current = null;
        }

        if (!currentPoints || currentPoints.length === 0) return;

        const markerClusterGroup = (L as any).markerClusterGroup({
            chunkedLoading: true,
            maxClusterRadius: 60,
            iconCreateFunction: (cluster: any) => {
                const markers = cluster.getAllChildMarkers();
                let overloadCount = 0, warningCount = 0;
                markers.forEach((m: L.Marker & { options: { status: VibrationPointStatus } }) => {
                    if (m.options.status === 'overload') overloadCount++;
                    else if (m.options.status === 'warning') warningCount++;
                });

                let c = ' marker-cluster-';
                const childCount = cluster.getChildCount();
                if (childCount < 10) c += 'small';
                else if (childCount < 100) c += 'medium';
                else c += 'large';
                
                const clusterClass = overloadCount > 0 ? 'marker-cluster-overload' : warningCount > 0 ? 'marker-cluster-warning' : 'marker-cluster-ok';

                return L.divIcon({
                    html: `<div><span>${childCount}</span></div>`,
                    className: `marker-cluster${c} ${clusterClass}`,
                    iconSize: L.point(40, 40)
                });
            },
        });
        
        markerClusterGroup.on('clustermouseover', (a: any) => {
            const markers = a.layer.getAllChildMarkers();
            let overloadCount = 0, warningCount = 0;
            markers.forEach((m: L.Marker & { options: { status: VibrationPointStatus } }) => { if (m.options.status === 'overload') overloadCount++; else if (m.options.status === 'warning') warningCount++; });
            const okCount = markers.length - overloadCount - warningCount;
            const parts = [];
            if (okCount > 0) parts.push(`<div class="status-ok">${t('ok')}: ${okCount}</div>`);
            if (warningCount > 0) parts.push(`<div class="status-warning">${t('warning')}: ${warningCount}</div>`);
            if (overloadCount > 0) parts.push(`<div class="status-overload">${t('overload')}: ${overloadCount}</div>`);
            a.layer.bindTooltip(`<b>Total: ${markers.length}</b><br>${parts.join('')}`, { direction: 'top', sticky: true, className: 'cluster-tooltip' }).openTooltip();
        });
        markerClusterGroup.on('clustermouseout', (a: any) => a.layer.closeTooltip());

        currentPoints.forEach(point => {
            const colorMap: {[key in VibrationPointStatus]: string} = {
                ok: theme.accent_secondary,
                warning: theme.warning,
                overload: theme.overload,
            };
            const marker = L.circleMarker([point.location.lat, point.location.lon], {
                radius: 6,
                fillColor: colorMap[point.status],
                color: theme.bg_primary,
                weight: 1.5,
                opacity: 1,
                fillOpacity: 0.8,
            });
            // Safely add custom property to options for clustering logic
            (marker.options as any).status = point.status;

            const tooltipContent = `
                <b>${t('popup_vibrator')} ${getNumericId(point.vibroId)}</b><br>
                ${t('popup_line')}: ${point.line} | ${t('popup_point')}: ${point.point}<br>
                ${t('time')}: ${point.time.toLocaleTimeString()}<br>
                ${t('popup_status')}: <span class="status-${point.status}">${t(point.status)}</span>
            `;
            marker.bindTooltip(tooltipContent, { className: 'vaps-tooltip' });
            
            markerClusterGroup.addLayer(marker);
        });

        map.addLayer(markerClusterGroup);
        layerRef.current = markerClusterGroup;
        
        if(currentPoints.length > 0 && currentPoints.length === totalPointsCount) {
            const bounds = markerClusterGroup.getBounds();
            if (bounds.isValid()) {
                map.flyToBounds(bounds, { padding: [50, 50], maxZoom: 18 });
            }
        }
        
        return () => {
            if (map && layerRef.current) {
                map.removeLayer(layerRef.current);
            }
        };

    }, [map, currentPoints, theme, i18nContextValue, t, totalPointsCount]);

    return null;
}


const SpsPointLayer: React.FC<any> = ({ map, spsPoints, colorMode, vibratorColors, theme, highlightedVibrators }) => {
    const layerRef = useRef<L.FeatureGroup | null>(null);
    const lastSpsPointsRef = useRef<string | null>(null);

    const getDifficultyColor = (difficulty: number) => {
        if (difficulty > 0.66) return theme.overload;
        if (difficulty > 0.33) return theme.warning;
        return theme.accent_secondary;
    };

    // Effect for drawing/updating markers
    useEffect(() => {
        if (!map) return;
        
        if (layerRef.current) {
            map.removeLayer(layerRef.current);
        }
        
        const layerGroup = L.featureGroup();
        spsPoints.forEach((p: any) => {
            const color = colorMode === 'assignment'
                ? (p.assignedVibrator ? vibratorColors[p.assignedVibrator] : '#888')
                : getDifficultyColor(p.difficulty);
            
            const isHighlighted = colorMode === 'assignment' && highlightedVibrators.includes(p.assignedVibrator);

            const marker = L.circleMarker([p.location.lat, p.location.lon], {
                radius: isHighlighted ? 8 : 5,
                fillColor: color,
                color: isHighlighted ? theme.text_primary : color,
                weight: isHighlighted ? 2 : 1,
                opacity: 1,
                fillOpacity: isHighlighted ? 1 : 0.7
            });
            marker.bindTooltip(`Line: ${p.line}, Station: ${p.station}<br>Difficulty: ${p.difficulty.toFixed(2)}`);
            layerGroup.addLayer(marker);
        });

        layerGroup.addTo(map);
        layerRef.current = layerGroup;

        return () => {
            if (layerRef.current && map.hasLayer(layerRef.current)) {
                map.removeLayer(layerRef.current);
                layerRef.current = null;
            }
        };
    }, [map, spsPoints, colorMode, vibratorColors, theme, highlightedVibrators]);

    // Effect for zooming to fit points only when the underlying data changes
    useEffect(() => {
        const spsPointsJSON = JSON.stringify(spsPoints.map((p:any) => p.id));
        if (map && layerRef.current && spsPoints.length > 0 && spsPointsJSON !== lastSpsPointsRef.current) {
            lastSpsPointsRef.current = spsPointsJSON;
            const bounds = layerRef.current.getBounds();
            if (bounds.isValid()) {
                map.flyToBounds(bounds, { padding: [50, 50] });
            }
        }
    }, [map, spsPoints]);

    return null;
}


const ControlPanel: React.FC<any> = ({ map, mode, setMode, plan, handleGeneratePlan, handleClearPlan, handleExportPlan, summaryData, colorMode, setColorMode, highlightedVibrators, setHighlightedVibrators, spsPoints, vapsPoints, hasVaps, statusFilters, setStatusFilters, activeVibratorId, setActiveVibratorId, sortedVibrators, vibratorSummaries, vibratorColors }) => {
    const { t, language } = useI18n();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);
    useEffect(() => { if (panelRef.current) L.DomEvent.disableClickPropagation(panelRef.current); }, []);

    const formatter = useMemo(
        () => new Intl.NumberFormat(language === 'fr' ? 'fr-FR' : 'en-US'),
        [language]
    );

    const plannerEnabled = spsPoints.length > 0 && summaryData;

    const spsInfo = useMemo(() => {
        if (!spsPoints || spsPoints.length === 0) return null;
        const totalPoints = spsPoints.length;
        const totalLines = new Set(spsPoints.map((p: SpsPoint) => p.line)).size;
        return { totalPoints, totalLines };
    }, [spsPoints]);

    const planStats = useMemo(() => {
        if (!plan) return {};
        const stats: { [key: string]: number } = {};
        plan.forEach((p: SpsPoint) => {
            if (p.assignedVibrator) {
                stats[p.assignedVibrator] = (stats[p.assignedVibrator] || 0) + 1;
            }
        });
        return stats;
    }, [plan]);

    const handleVibratorToggle = (vibId: string) => {
        setHighlightedVibrators((current: string[]) => {
            const newSet = new Set(current);
            if (newSet.has(vibId)) {
                newSet.delete(vibId);
            } else {
                newSet.add(vibId);
            }
            return Array.from(newSet);
        });
    };

    return (
        <div ref={panelRef} className={`absolute top-6 left-6 z-[1002] transition-all duration-300 ${isCollapsed ? 'w-14 h-14' : 'w-[360px]'}`}>
            <button onClick={() => setIsCollapsed(!isCollapsed)} className="absolute -right-3 top-4 bg-bg-tertiary p-1 rounded-full border border-border-color hover:bg-border-color">
                {isCollapsed ? <Menu size={16} /> : <ChevronLeft size={16} />}
            </button>

            <div className={`p-4 transition-opacity duration-200 ${isCollapsed ? 'opacity-0 invisible' : 'opacity-100 visible'}`} style={{height: 'calc(100vh - 48px)'}}>
                <h2 className="text-lg font-bold flex items-center gap-2 mb-2 pb-2 border-b border-border-color">{t('geoPlanner')}</h2>

                <div className="flex bg-bg-tertiary rounded-md p-1 mb-4">
                    {hasVaps && <button onClick={() => setMode('analysis')} className={`flex-1 text-sm font-semibold p-2 rounded ${mode === 'analysis' ? 'bg-accent-primary text-white' : 'hover:bg-bg-secondary'}`}><BarChart2 size={16} className="inline mr-1"/>{t('analysis')}</button>}
                    {spsPoints.length > 0 && <button onClick={() => setMode('planner')} className={`flex-1 text-sm font-semibold p-2 rounded ${mode === 'planner' ? 'bg-accent-primary text-white' : 'hover:bg-bg-secondary'}`}><Compass size={16} className="inline mr-1"/>{t('planner')}</button>}
                </div>

                <div className="h-[calc(100%-80px)] overflow-y-auto pr-2 -mr-2">
                    {mode === 'planner' && (
                        <div>
                            {spsInfo && (
                                <div className="mb-4 p-3 bg-bg-secondary rounded-md border border-border-color">
                                    <h3 className="font-semibold text-sm text-text-secondary mb-2 flex items-center gap-2"><Database size={16}/> {t('spsPlanData')}</h3>
                                    <div className="space-y-1 text-sm">
                                        <div className="flex justify-between"><span>{t('totalSpsPoints')}:</span><span className="font-bold">{formatter.format(spsInfo.totalPoints)}</span></div>
                                        <div className="flex justify-between"><span>{t('totalSpsLines')}:</span><span className="font-bold">{formatter.format(spsInfo.totalLines)}</span></div>
                                    </div>
                                </div>
                            )}
                            {!plannerEnabled && <div className="text-center text-sm text-text-secondary p-4 bg-bg-secondary rounded-md">{spsPoints.length === 0 ? t('noSpsData') : t('noVapsDataForPlanning')}</div>}
                            
                            {plannerEnabled && (
                                <>
                                    <div className="space-y-2 mb-4">
                                        <button onClick={handleGeneratePlan} className="w-full flex items-center justify-center gap-2 p-2 rounded-md bg-accent-primary text-white font-semibold hover:opacity-90"><Sparkles size={16}/>{t('generatePlan')}</button>
                                        <div className="flex gap-2">
                                            <button onClick={handleClearPlan} disabled={!plan} className="w-full flex items-center justify-center gap-2 p-2 rounded-md bg-bg-tertiary text-text-secondary font-semibold hover:bg-border-color disabled:opacity-50"><Trash2 size={16}/>{t('clearPlan')}</button>
                                            <button onClick={handleExportPlan} disabled={!plan} className="w-full flex items-center justify-center gap-2 p-2 rounded-md bg-bg-tertiary text-text-secondary font-semibold hover:bg-border-color disabled:opacity-50"><Download size={16}/>{t('exportPlan')}</button>
                                        </div>
                                    </div>

                                    {plan && <div className="mb-3">
                                        <h3 className="font-semibold text-sm text-text-secondary mb-2 flex items-center gap-2"><Palette size={16}/> {t('colorBy')}</h3>
                                        <div className="flex bg-bg-tertiary rounded-md p-1">
                                            <button onClick={()=>setColorMode('difficulty')} className={`flex-1 text-xs p-1 rounded ${colorMode==='difficulty' ? 'bg-bg-primary shadow-sm':''}`}>{t('difficulty')}</button>
                                            <button onClick={()=>setColorMode('assignment')} className={`flex-1 text-xs p-1 rounded ${colorMode==='assignment' ? 'bg-bg-primary shadow-sm':''}`}>{t('assignment')}</button>
                                        </div>
                                    </div>}

                                    <div>
                                        <h3 className="font-semibold text-sm text-text-secondary mb-2 flex items-center gap-2"><Users size={16}/>{t('vibratorFleet')}</h3>
                                        <div className="space-y-1">
                                            {summaryData?.individual_performance.map((vib: any) => {
                                                const isHighlighted = highlightedVibrators.includes(vib.vibro_id);
                                                return (
                                                    <div key={vib.vibro_id} onClick={() => plan && handleVibratorToggle(vib.vibro_id)} className={`p-2 rounded-md cursor-pointer flex items-center gap-3 ${isHighlighted ? 'bg-accent-primary/20 ring-1 ring-accent-primary' : 'bg-bg-secondary'}`}>
                                                        <div className="w-4 h-4 rounded-full" style={{backgroundColor: vibratorColors[vib.vibro_id]}}></div>
                                                        <div className="flex-grow">
                                                            <div className="flex justify-between items-center">
                                                                <span className="font-bold text-sm text-text-primary">{vib.vibro_id}</span>
                                                                {plan && <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-bg-primary text-text-secondary">{formatter.format(planStats[vib.vibro_id] || 0)} {t('tasksAssigned')}</span>}
                                                            </div>
                                                            <div className="text-xs text-text-secondary mt-1">{t('efficiency')}: {vib.efficiencyScore.toFixed(1)}%</div>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {mode === 'analysis' && (
                       <div>
                            <div className="mb-4">
                                <h3 className="font-semibold text-sm mb-2 flex items-center gap-2"><SlidersHorizontal size={16} /> {t('filterPoints')}</h3>
                                <div className="space-y-2 text-sm">
                                    {['ok', 'warning', 'overload'].map(status => (
                                        <label key={status} className="flex items-center gap-2 cursor-pointer p-2 rounded-md hover:bg-bg-secondary">
                                            {(statusFilters as any)[status] ? <CheckSquare size={16} className="text-accent-primary"/> : <Square size={16} className="text-text-secondary"/>}
                                            <input type="checkbox" checked={(statusFilters as any)[status]} onChange={e => setStatusFilters((f:any) => ({...f, [status]: e.target.checked}))} className="hidden"/>
                                            <span>{t(status)}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <h3 className="font-semibold text-sm mb-2 flex items-center gap-2"><Users size={16}/>{t('vibratorList')}</h3>
                                <div className="space-y-1">
                                    <button onClick={() => setActiveVibratorId(null)} className={`w-full text-left p-2 text-sm rounded-md font-semibold flex items-center justify-between transition-colors ${activeVibratorId === null ? 'bg-accent-primary text-white' : 'bg-bg-secondary hover:bg-bg-tertiary'}`}>
                                        <span className="flex items-center gap-2">
                                            <Eye size={16} />
                                            {t('showAll')}
                                        </span>
                                        <span className="bg-bg-primary text-text-secondary text-xs font-mono px-2 py-0.5 rounded-full">{formatter.format(vapsPoints.length)}</span>
                                    </button>
                                    {sortedVibrators.map((id: string) => (
                                        <button key={id} onClick={() => setActiveVibratorId(id)} className={`w-full text-left p-2 text-sm rounded-md font-semibold flex items-center justify-between transition-colors ${activeVibratorId === id ? 'bg-accent-primary text-white' : 'bg-bg-secondary hover:bg-bg-tertiary'}`}>
                                            <span>{`${t('popup_vibrator')} ${getNumericId(id)}`}</span>
                                            <span className="bg-bg-primary text-text-secondary text-xs font-mono px-2 py-0.5 rounded-full">{formatter.format(vibratorSummaries.get(id)?.count || 0)}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                       </div>
                    )}
                </div>
            </div>
        </div>
    );
}


const MapHud: React.FC<{
    mode: 'analysis' | 'planner';
    colorMode: 'difficulty' | 'assignment';
    totalVaps: number;
    visibleVaps: number;
    totalSps: number;
    plannedCount: number;
    summaryData: SummaryData | null | undefined;
    onRecenter: () => void;
}> = ({ mode, colorMode, totalVaps, visibleVaps, totalSps, plannedCount, summaryData, onRecenter }) => {
    const { t, language } = useI18n();
    const formatter = useMemo(
        () => new Intl.NumberFormat(language === 'fr' ? 'fr-FR' : 'en-US'),
        [language]
    );

    const metrics = useMemo(() => {
        if (mode === 'planner') {
            return [
                { key: 'totalSps', label: t('planningPoints'), value: formatter.format(totalSps) },
                { key: 'tasks', label: t('tasksAssigned'), value: formatter.format(plannedCount) },
                { key: 'fleet', label: t('vibratorFleet'), value: formatter.format(summaryData?.individual_performance.length ?? 0) },
            ];
        }
        return [
            { key: 'visible', label: t('vibrationPoints'), value: `${formatter.format(visibleVaps)} / ${formatter.format(Math.max(totalVaps, visibleVaps))}` },
            { key: 'netOps', label: t('netOperations'), value: formatter.format(summaryData?.general_summary.net_operations ?? 0) },
            { key: 'duplicates', label: t('totalDuplicates'), value: formatter.format(summaryData?.general_summary.total_duplicates ?? 0) },
        ];
    }, [formatter, mode, plannedCount, summaryData, t, totalSps, totalVaps, visibleVaps]);

    const legendItems = useMemo(() => {
        if (mode === 'analysis') {
            return [
                { key: 'ok', label: t('ok'), color: 'var(--color-success)' },
                { key: 'warning', label: t('warning'), color: 'var(--color-warning)' },
                { key: 'overload', label: t('overload'), color: 'var(--color-overload)' },
            ];
        }
        if (colorMode === 'assignment') {
            return [
                { key: 'assignment', label: t('colorBy_assignment'), color: 'var(--color-accent-primary)' },
                { key: 'unassigned', label: t('clearSelection'), color: '#6b7280' },
            ];
        }
        return [
            { key: 'low', label: t('low'), color: 'var(--color-accent-secondary)' },
            { key: 'medium', label: t('medium'), color: 'var(--color-warning)' },
            { key: 'high', label: t('high'), color: 'var(--color-overload)' },
        ];
    }, [colorMode, mode, t]);

    return (
        <div className="pointer-events-none absolute top-6 right-6 flex flex-col gap-3">
            <div className="pointer-events-auto w-[320px] rounded-3xl border border-border-light/80 bg-gradient-to-br from-bg-primary/90 via-bg-primary/70 to-bg-secondary/60 px-6 py-5 shadow-[0_35px_80px_-50px_rgba(15,23,42,0.7)] backdrop-blur-xl">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-text-tertiary">{t('mapView')}</p>
                        <h3 className="mt-2 text-xl font-bold text-text-primary">{mode === 'planner' ? t('planner') : t('analysis')}</h3>
                    </div>
                    <button
                        type="button"
                        onClick={onRecenter}
                        className="flex h-10 w-10 items-center justify-center rounded-full border border-border-light/70 bg-bg-secondary text-text-secondary transition hover:border-accent-primary hover:text-accent-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-primary"
                    >
                        <Compass size={18} />
                        <span className="sr-only">{t('reset')}</span>
                    </button>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-3">
                    {metrics.map(metric => (
                        <div key={metric.key} className="rounded-2xl border border-border-light/70 bg-bg-primary/60 px-3 py-3">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-text-tertiary">{metric.label}</p>
                            <p className="mt-2 text-xl font-bold text-text-primary">{metric.value}</p>
                        </div>
                    ))}
                </div>
            </div>
            <div className="pointer-events-auto inline-flex items-center gap-3 self-end rounded-full border border-border-light/70 bg-bg-secondary/70 px-4 py-2 shadow-[0_25px_60px_-45px_rgba(15,23,42,0.5)] backdrop-blur-lg">
                {legendItems.map(item => (
                    <span key={item.key} className="flex items-center gap-2 text-xs font-semibold text-text-secondary">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                        {item.label}
                    </span>
                ))}
            </div>
        </div>
    );
};

export default MapModal;
