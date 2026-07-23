/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { 
  Upload, Download, Split, Info, CheckCircle2, AlertCircle, 
  RefreshCw, Instagram, ArrowRight, Layout, Scissors, 
  Settings, Image as ImageIcon, Gamepad2, Archive
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Cropper, { Area } from 'react-easy-crop';
import JSZip from 'jszip';

// Constants for Instagram Banner
const INSTA_BANNER_WIDTH = 3039;
const INSTA_BANNER_HEIGHT = 1350;
const INSTA_SLICE_WIDTH = 1013; // 3039 / 3
const INSTA_FINAL_WIDTH = 1080; // Standard Instagram Portrait
const INSTA_FINAL_HEIGHT = 1350;

// Constants for Steam Profile Art
const STEAM_MAIN_WIDTH = 506;
const STEAM_SIDEBAR_WIDTH = 100;
const STEAM_GAP = 4;
const STEAM_TOTAL_WIDTH = STEAM_MAIN_WIDTH + STEAM_GAP + STEAM_SIDEBAR_WIDTH;

type ToolType = 'instagram' | 'steam';
type QualityType = 'high' | 'medium' | 'low';

interface Slice {
  id: string;
  name: string;
  dataUrl: string;
}

export default function App() {
  const [activeTool, setActiveTool] = useState<ToolType>('instagram');
  const [image, setImage] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isCropping, setIsCropping] = useState(false);
  const [slices, setSlices] = useState<Slice[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quality, setQuality] = useState<QualityType>('high');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onCropComplete = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const [fileType, setFileType] = useState<'image' | 'video'>('image');
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const isVideo = file.type.startsWith('video/');
      const isImage = file.type.startsWith('image/');

      if (!isImage && !isVideo) {
        setError('Please upload a valid image or video file.');
        return;
      }

      setFileType(isVideo ? 'video' : 'image');
      const url = URL.createObjectURL(file);
      setImage(url);
      setSlices([]);
      setError(null);
      setIsCropping(true);
    }
  };

  const getMimeType = () => {
    switch (quality) {
      case 'high': return 'image/png';
      case 'medium': return 'image/jpeg';
      case 'low': return 'image/jpeg';
      default: return 'image/png';
    }
  };

  const getQualityValue = () => {
    switch (quality) {
      case 'high': return 1.0;
      case 'medium': return 0.8;
      case 'low': return 0.5;
      default: return 1.0;
    }
  };

  const processImage = useCallback(async () => {
    if (!image || !croppedAreaPixels) return;
    setIsProcessing(true);
    setError(null);

    try {
      let source: HTMLImageElement | HTMLVideoElement;

      if (fileType === 'video') {
        const video = document.createElement('video');
        video.src = image;
        video.crossOrigin = 'anonymous';
        video.currentTime = videoRef.current?.currentTime || 0;
        await new Promise((resolve, reject) => {
          video.onloadeddata = resolve;
          video.onerror = reject;
        });
        source = video;
      } else {
        const img = new Image();
        img.src = image;
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
        });
        source = img;
      }

      const newSlices: Slice[] = [];
      const mimeType = getMimeType();
      const qualityValue = getQualityValue();

      const sourceWidth = fileType === 'video' ? (source as HTMLVideoElement).videoWidth : (source as HTMLImageElement).width;
      const sourceHeight = fileType === 'video' ? (source as HTMLVideoElement).videoHeight : (source as HTMLImageElement).height;

      if (activeTool === 'instagram') {
        // Instagram Logic: Split into 3
        const sliceWidth = croppedAreaPixels.width / 3;
        const sliceHeight = croppedAreaPixels.height;
        for (let i = 0; i < 3; i++) {
          const sliceCanvas = document.createElement('canvas');
          sliceCanvas.width = sliceWidth;
          sliceCanvas.height = sliceHeight;
          const ctx = sliceCanvas.getContext('2d');
          if (!ctx) continue;

          ctx.drawImage(
            source,
            croppedAreaPixels.x + i * sliceWidth, croppedAreaPixels.y, sliceWidth, sliceHeight,
            0, 0, sliceWidth, sliceHeight
          );

          newSlices.push({
            id: `insta-${i + 1}`,
            name: `insta-part-${i + 1}`,
            dataUrl: sliceCanvas.toDataURL(mimeType, qualityValue)
          });
        }
      } else {
        // Steam Logic: Main + Sidebar
        const mainWidthRatio = STEAM_MAIN_WIDTH / STEAM_TOTAL_WIDTH;
        const sidebarWidthRatio = STEAM_SIDEBAR_WIDTH / STEAM_TOTAL_WIDTH;
        const gapWidthRatio = STEAM_GAP / STEAM_TOTAL_WIDTH;

        const mainWidth = croppedAreaPixels.width * mainWidthRatio;
        const sidebarWidth = croppedAreaPixels.width * sidebarWidthRatio;
        const gapWidth = croppedAreaPixels.width * gapWidthRatio;

        // Main Art
        const mainCanvas = document.createElement('canvas');
        mainCanvas.width = STEAM_MAIN_WIDTH;
        mainCanvas.height = croppedAreaPixels.height * (STEAM_MAIN_WIDTH / mainWidth);
        const mainCtx = mainCanvas.getContext('2d');
        if (mainCtx) {
          mainCtx.drawImage(
            source,
            croppedAreaPixels.x, croppedAreaPixels.y, mainWidth, croppedAreaPixels.height,
            0, 0, mainCanvas.width, mainCanvas.height
          );
          newSlices.push({
            id: 'steam-main',
            name: 'steam-profile-main',
            dataUrl: mainCanvas.toDataURL(mimeType, qualityValue)
          });
        }

        // Sidebar Art
        const sideCanvas = document.createElement('canvas');
        sideCanvas.width = STEAM_SIDEBAR_WIDTH;
        sideCanvas.height = mainCanvas.height;
        const sideCtx = sideCanvas.getContext('2d');
        if (sideCtx) {
          sideCtx.drawImage(
            source,
            croppedAreaPixels.x + mainWidth + gapWidth, croppedAreaPixels.y, sidebarWidth, croppedAreaPixels.height,
            0, 0, sideCanvas.width, sideCanvas.height
          );
          newSlices.push({
            id: 'steam-side',
            name: 'steam-profile-sidebar',
            dataUrl: sideCanvas.toDataURL(mimeType, qualityValue)
          });
        }
      }

      setSlices(newSlices);
      setIsCropping(false);
    } catch (err) {
      console.error(err);
      setError('Failed to process file. Make sure it is a valid format.');
    } finally {
      setIsProcessing(false);
    }
  }, [image, croppedAreaPixels, activeTool, quality, fileType]);

  const downloadAll = async () => {
    if (slices.length === 0) return;
    const zip = new JSZip();
    const folder = zip.folder(`${activeTool}-banner`);
    
    slices.forEach((slice) => {
      const base64Data = slice.dataUrl.split(',')[1];
      const extension = quality === 'high' ? 'png' : 'jpg';
      folder?.file(`${slice.name}.${extension}`, base64Data, { base64: true });
    });

    const content = await zip.generateAsync({ type: 'blob' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(content);
    link.download = `${activeTool}-banner-pack.zip`;
    link.click();
  };

  const downloadSlice = (slice: Slice) => {
    const link = document.createElement('a');
    link.href = slice.dataUrl;
    const extension = quality === 'high' ? 'png' : 'jpg';
    link.download = `${slice.name}.${extension}`;
    link.click();
  };

  const reset = () => {
    setImage(null);
    setSlices([]);
    setError(null);
    setIsCropping(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#E0E0E0] font-sans selection:bg-[#F27D26] selection:text-white">
      {/* Header */}
      <header className="border-b border-[#222] bg-[#0F0F0F]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#F27D26] rounded-lg flex items-center justify-center">
              <Layout className="text-white w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold tracking-tight uppercase">Banner <span className="text-[#F27D26]">Pro</span></h1>
          </div>
          
          <div className="flex bg-[#1A1B1E] rounded-full p-1 border border-[#333]">
            <button 
              onClick={() => { setActiveTool('instagram'); reset(); }}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-2 ${activeTool === 'instagram' ? 'bg-[#F27D26] text-white' : 'text-[#888] hover:text-white'}`}
            >
              <Instagram size={14} /> Instagram
            </button>
            <button 
              onClick={() => { setActiveTool('steam'); reset(); }}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-2 ${activeTool === 'steam' ? 'bg-[#F27D26] text-white' : 'text-[#888] hover:text-white'}`}
            >
              <Gamepad2 size={14} /> Steam
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          
          {/* Left Column: Tool */}
          <div className="lg:col-span-7 space-y-8">
            <section className="bg-[#151619] border border-[#222] rounded-2xl p-8 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                {activeTool === 'instagram' ? <Instagram size={120} /> : <Gamepad2 size={120} />}
              </div>
              
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
                    <div className="w-2 h-6 bg-[#F27D26] rounded-full"></div>
                    {activeTool === 'instagram' ? 'Instagram Banner' : 'Steam Profile Art'}
                  </h2>
                  <p className="text-[#888] text-sm">
                    {activeTool === 'instagram' 
                      ? 'Split your image into 3 seamless portrait posts.' 
                      : 'Create a main art piece and a sidebar for your Steam profile.'}
                  </p>
                </div>
                
                <div className="flex flex-col items-end gap-2">
                  <span className="text-[10px] font-bold text-[#555] uppercase tracking-widest">Quality</span>
                  <div className="flex bg-[#0A0A0A] rounded-lg p-1 border border-[#222]">
                    {(['high', 'medium', 'low'] as QualityType[]).map((q) => (
                      <button
                        key={q}
                        onClick={() => setQuality(q)}
                        className={`px-2 py-1 rounded text-[10px] font-bold uppercase transition-all ${quality === q ? 'bg-[#F27D26] text-white' : 'text-[#555] hover:text-[#888]'}`}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {!image ? (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="border-2 border-dashed border-[#333] rounded-xl p-12 flex flex-col items-center justify-center cursor-pointer hover:border-[#F27D26] hover:bg-[#F27D26]/5 transition-all group"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="w-12 h-12 text-[#444] group-hover:text-[#F27D26] transition-colors mb-4" />
                  <p className="text-lg font-medium mb-1">Upload your artwork</p>
                  <p className="text-xs text-[#666]">
                    {activeTool === 'instagram' ? 'Recommended: 3039 x 1350px' : 'Recommended: 1920 x 1080px'}
                  </p>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileChange} 
                    className="hidden" 
                    accept="image/*"
                  />
                </motion.div>
              ) : isCropping ? (
                <div className="space-y-6">
                  <div className="relative h-[400px] bg-[#000] rounded-xl overflow-hidden border border-[#333]">
                    <Cropper
                      image={fileType === 'image' ? image : undefined}
                      video={fileType === 'video' ? image : undefined}
                      crop={crop}
                      zoom={zoom}
                      aspect={activeTool === 'instagram' ? 3039 / 1350 : STEAM_TOTAL_WIDTH / 500}
                      onCropChange={setCrop}
                      onCropComplete={onCropComplete}
                      onZoomChange={setZoom}
                      onMediaLoaded={(media) => {
                        if (fileType === 'video') {
                          (videoRef as any).current = media.video;
                        }
                      }}
                    />
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex-1 flex items-center gap-3">
                      <span className="text-xs font-bold text-[#555]">ZOOM</span>
                      <input
                        type="range"
                        value={zoom}
                        min={1}
                        max={3}
                        step={0.1}
                        aria-labelledby="Zoom"
                        onChange={(e) => setZoom(Number(e.target.value))}
                        className="flex-1 accent-[#F27D26]"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={reset}
                        className="px-6 py-2 rounded-lg bg-[#222] hover:bg-[#333] text-xs font-bold transition-all"
                      >
                        CANCEL
                      </button>
                      <button 
                        onClick={processImage}
                        disabled={isProcessing}
                        className="px-8 py-2 rounded-lg bg-[#F27D26] hover:bg-[#ff8c3a] text-xs font-bold transition-all flex items-center gap-2"
                      >
                        {isProcessing ? <RefreshCw className="animate-spin" size={14} /> : <Scissors size={14} />}
                        CROP & SPLIT
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {slices.length > 0 && (
                    <div className="bg-[#1A1B1E] border border-[#222] rounded-xl p-6 space-y-6">
                      <div className="flex items-center justify-between">
                        <h3 className="font-bold flex items-center gap-2">
                          <CheckCircle2 className="text-green-500 w-5 h-5" />
                          Artwork Ready
                        </h3>
                        <div className="flex gap-3">
                          <button 
                            onClick={downloadAll}
                            className="bg-[#F27D26] hover:bg-[#ff8c3a] text-white px-4 py-2 rounded-lg flex items-center gap-2 text-xs font-bold transition-all shadow-lg shadow-[#F27D26]/20"
                          >
                            <Archive size={14} /> DOWNLOAD ALL (.ZIP)
                          </button>
                          <button onClick={reset} className="text-xs text-[#888] hover:text-white underline">Start Over</button>
                        </div>
                      </div>
                      
                      <div className={`grid ${activeTool === 'instagram' ? 'grid-cols-3' : 'grid-cols-2'} gap-4`}>
                        {slices.map((slice) => (
                          <div key={slice.id} className="space-y-3">
                            <div className={`bg-[#000] rounded-lg border border-[#333] overflow-hidden relative group ${activeTool === 'instagram' ? 'aspect-[1080/1350]' : ''}`}>
                              <img src={slice.dataUrl} alt={slice.name} className="w-full h-full object-contain" />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                <span className="text-[10px] font-mono bg-black/80 px-2 py-1 rounded uppercase">{slice.id}</span>
                              </div>
                            </div>
                            <button 
                              onClick={() => downloadSlice(slice)}
                              className="w-full bg-[#333] hover:bg-[#444] text-white py-2 rounded-lg flex items-center justify-center gap-2 text-xs font-bold transition-colors"
                            >
                              <Download className="w-4 h-4" />
                              SAVE
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {error && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-4 p-4 bg-red-900/20 border border-red-900/50 rounded-lg flex items-center gap-3 text-red-400 text-sm"
                >
                  <AlertCircle className="shrink-0" />
                  {error}
                </motion.div>
              )}
            </section>

            {/* Guide Section */}
            <section className="bg-[#151619] border border-[#222] rounded-2xl p-8">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                <Info className="text-[#F27D26] w-5 h-5" />
                {activeTool === 'instagram' ? 'Instagram Guide' : 'Steam Guide'}
              </h2>
              <div className="space-y-6">
                {activeTool === 'instagram' ? (
                  <>
                    <div className="flex gap-4">
                      <div className="w-8 h-8 rounded-full bg-[#222] flex items-center justify-center shrink-0 font-mono text-xs border border-[#333]">01</div>
                      <div>
                        <p className="font-bold text-sm mb-1">Upload in Reverse</p>
                        <p className="text-xs text-[#888]">Post Part 3, then Part 2, then Part 1. They will appear in the correct order on your grid.</p>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <div className="w-8 h-8 rounded-full bg-[#222] flex items-center justify-center shrink-0 font-mono text-xs border border-[#333]">02</div>
                      <div>
                        <p className="font-bold text-sm mb-1">Pin to Profile</p>
                        <p className="text-xs text-[#888]">Go to each post and select "Pin to your profile" to lock them at the top.</p>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex gap-4">
                      <div className="w-8 h-8 rounded-full bg-[#222] flex items-center justify-center shrink-0 font-mono text-xs border border-[#333]">01</div>
                      <div>
                        <p className="font-bold text-sm mb-1">Upload to Artwork</p>
                        <p className="text-xs text-[#888]">Upload both pieces to your Steam Artwork gallery. Check "I certify that I created this artwork".</p>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <div className="w-8 h-8 rounded-full bg-[#222] flex items-center justify-center shrink-0 font-mono text-xs border border-[#333]">02</div>
                      <div>
                        <p className="font-bold text-sm mb-1">Profile Showcase</p>
                        <p className="text-xs text-[#888]">Edit your Steam Profile, go to "Featured Showcase", select "Artwork Showcase", and pick your main and sidebar pieces.</p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </section>
          </div>

          {/* Right Column: Info & Tips */}
          <div className="lg:col-span-5 space-y-8">
            <div className="bg-gradient-to-br from-[#F27D26] to-[#ff4e00] rounded-2xl p-8 text-white shadow-xl">
              <h3 className="text-2xl font-black uppercase leading-tight mb-4 italic">
                {activeTool === 'instagram' ? 'Seamless Grid' : 'Steam Masterpiece'}
              </h3>
              <p className="text-white/80 text-sm mb-6 leading-relaxed">
                {activeTool === 'instagram' 
                  ? 'Our tool ensures your banner is perfectly centered on a 1080x1350 canvas, making it look professional in both grid and post views.'
                  : 'Steam profile art requires precise dimensions (506px for main, 100px for sidebar). We handle the math so your background flows perfectly.'}
              </p>
              <div className="flex items-center gap-2 text-xs font-bold bg-black/20 w-fit px-3 py-1 rounded-full">
                <CheckCircle2 className="w-3 h-3" />
                PROFESSIONAL EXPORT
              </div>
            </div>

            <div className="bg-[#151619] border border-[#222] rounded-2xl p-8">
              <h3 className="font-bold mb-4 uppercase tracking-widest text-xs text-[#F27D26]">Output Settings</h3>
              <div className="space-y-4">
                <div className="p-4 bg-[#0A0A0A] rounded-xl border border-[#222]">
                  <p className="text-[10px] font-bold text-[#555] mb-2 uppercase">Current Format</p>
                  <p className="text-sm font-mono text-white">
                    {quality === 'high' ? 'PNG (Lossless)' : `JPEG (${quality === 'medium' ? '80%' : '50%'} Quality)`}
                  </p>
                </div>
                <div className="p-4 bg-[#0A0A0A] rounded-xl border border-[#222]">
                  <p className="text-[10px] font-bold text-[#555] mb-2 uppercase">Dimensions</p>
                  <p className="text-sm font-mono text-white">
                    {activeTool === 'instagram' ? '1080 x 1350 px' : '506px & 100px Wide'}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-8 border border-[#222] rounded-2xl bg-[#0F0F0F] relative overflow-hidden group">
              <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity rotate-12">
                <Settings size={160} />
              </div>
              <h3 className="font-bold mb-2">Pro Tip</h3>
              <p className="text-xs text-[#666] leading-relaxed">
                For Steam profiles, use a background that matches your profile theme. For Instagram, use the cropping tool to focus on the most visually striking part of your image.
              </p>
            </div>
          </div>

        </div>
      </main>

      <footer className="max-w-6xl mx-auto px-6 py-12 border-t border-[#222] text-center">
        <p className="text-xs text-[#444] uppercase tracking-[0.2em]">
          Banner Pro &copy; 2026 &bull; Professional Content Tools
        </p>
      </footer>
    </div>
  );
}
