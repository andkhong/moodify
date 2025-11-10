"use client"

import React, { useState, useEffect, useRef } from 'react';
import { Camera, Music, Plus, Trash2, Play, Pause, Volume2 } from 'lucide-react';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

// Mood to YouTube search query mapping
const moodToMusic = {
  happy: 'upbeat happy music playlist',
  sad: 'melancholic calm music',
  angry: 'intense energetic music',
  neutral: 'ambient chill music',
  surprised: 'exciting uplifting music',
  fearful: 'calming soothing music',
  disgusted: 'alternative indie music'
};

// Mood to color mapping for UI
const moodColors = {
  happy: 'from-yellow-400 to-orange-500',
  sad: 'from-blue-400 to-indigo-600',
  angry: 'from-red-500 to-red-700',
  neutral: 'from-gray-400 to-gray-600',
  surprised: 'from-purple-400 to-pink-500',
  fearful: 'from-teal-400 to-cyan-600',
  disgusted: 'from-green-500 to-emerald-700'
};

const MoodMusicApp = () => {
  const [currentMood, setCurrentMood] = useState('neutral');
  const [moodQueue, setMoodQueue] = useState([]);
  const [isWebcamActive, setIsWebcamActive] = useState(false);
  const [currentVideo, setCurrentVideo] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [detectionStatus, setDetectionStatus] = useState('Initializing AI...');
  const [faceLandmarker, setFaceLandmarker] = useState(null);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  
  const videoRef = useRef(null);
  const playerRef = useRef(null);
  const animationFrameRef = useRef(null);
  const lastVideoTimeRef = useRef(-1);
  const moodHistoryRef = useRef([]);
  const MOOD_HISTORY_LENGTH = 15; // Smooth over ~15 frames

  // Initialize MediaPipe Face Landmarker
  useEffect(() => {
    const initializeFaceLandmarker = async () => {
      try {
        setDetectionStatus('Loading AI model...');
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
        );
        
        const landmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
            delegate: 'GPU'
          },
          outputFaceBlendshapes: true,
          outputFacialTransformationMatrixes: true,
          runningMode: 'VIDEO',
          numFaces: 1
        });
        
        setFaceLandmarker(landmarker);
        setIsModelLoaded(true);
        setDetectionStatus('AI model loaded');
      } catch (error) {
        console.error('Error loading MediaPipe:', error);
        setDetectionStatus('Failed to load AI model');
      }
    };

    initializeFaceLandmarker();
  }, []);

  // Initialize webcam
  const startWebcam = async () => {
    try {
      setDetectionStatus('Requesting camera access...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: 1280, 
          height: 720,
          facingMode: 'user'
        }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        videoRef.current.onloadedmetadata = () => {
          console.log('Video metadata loaded:', {
            width: videoRef.current.videoWidth,
            height: videoRef.current.videoHeight,
            readyState: videoRef.current.readyState
          });
        };
        
        videoRef.current.onloadeddata = () => {
          console.log('Video data loaded, readyState:', videoRef.current.readyState);
          setIsWebcamActive(true);
          setDetectionStatus('Camera active - Detecting mood...');
        };
        
        // Fallback: Set active after a short delay if events don't fire
        setTimeout(() => {
          if (!isWebcamActive && videoRef.current && videoRef.current.readyState >= 2) {
            console.log('Fallback: Setting webcam active');
            setIsWebcamActive(true);
            setDetectionStatus('Camera active - Detecting mood...');
          }
        }, 1000);
      }
    } catch (err) {
      console.error('Error accessing webcam:', err);
      setDetectionStatus(`Camera error: ${err.message}`);
    }
  };

  // Calculate mood from facial blendshapes with advanced scoring system
  const calculateMoodFromBlendshapes = (blendshapes) => {
    if (!blendshapes || blendshapes.length === 0) {
      return 'neutral';
    }

    const shapes = blendshapes[0].categories;
    const shapeMap = {};
    shapes.forEach(shape => {
      shapeMap[shape.categoryName] = shape.score;
    });

    // Extract all facial features
    const features = {
      // Smile indicators
      smileLeft: shapeMap['mouthSmileLeft'] || 0,
      smileRight: shapeMap['mouthSmileRight'] || 0,
      smile: ((shapeMap['mouthSmileLeft'] || 0) + (shapeMap['mouthSmileRight'] || 0)) / 2,
      
      // Frown/sad mouth
      frownLeft: shapeMap['mouthFrownLeft'] || 0,
      frownRight: shapeMap['mouthFrownRight'] || 0,
      frown: ((shapeMap['mouthFrownLeft'] || 0) + (shapeMap['mouthFrownRight'] || 0)) / 2,
      
      // Lip and mouth movements
      mouthUpperUpLeft: shapeMap['mouthUpperUpLeft'] || 0,
      mouthUpperUpRight: shapeMap['mouthUpperUpRight'] || 0,
      mouthUpperUp: ((shapeMap['mouthUpperUpLeft'] || 0) + (shapeMap['mouthUpperUpRight'] || 0)) / 2,
      
      // Brow movements
      browDownLeft: shapeMap['browDownLeft'] || 0,
      browDownRight: shapeMap['browDownRight'] || 0,
      browDown: ((shapeMap['browDownLeft'] || 0) + (shapeMap['browDownRight'] || 0)) / 2,
      browInnerUp: shapeMap['browInnerUp'] || 0,
      browOuterUpLeft: shapeMap['browOuterUpLeft'] || 0,
      browOuterUpRight: shapeMap['browOuterUpRight'] || 0,
      browOuterUp: ((shapeMap['browOuterUpLeft'] || 0) + (shapeMap['browOuterUpRight'] || 0)) / 2,
      
      // Eye movements
      eyeWideLeft: shapeMap['eyeWideLeft'] || 0,
      eyeWideRight: shapeMap['eyeWideRight'] || 0,
      eyeWide: ((shapeMap['eyeWideLeft'] || 0) + (shapeMap['eyeWideRight'] || 0)) / 2,
      eyeSquintLeft: shapeMap['eyeSquintLeft'] || 0,
      eyeSquintRight: shapeMap['eyeSquintRight'] || 0,
      eyeSquint: ((shapeMap['eyeSquintLeft'] || 0) + (shapeMap['eyeSquintRight'] || 0)) / 2,
      eyeBlinkLeft: shapeMap['eyeBlinkLeft'] || 0,
      eyeBlinkRight: shapeMap['eyeBlinkRight'] || 0,
      
      // Mouth shape
      mouthPucker: shapeMap['mouthPucker'] || 0,
      mouthFunnel: shapeMap['mouthFunnel'] || 0,
      jawOpen: shapeMap['jawOpen'] || 0,
      mouthClose: shapeMap['mouthClose'] || 0,
      mouthStretchLeft: shapeMap['mouthStretchLeft'] || 0,
      mouthStretchRight: shapeMap['mouthStretchRight'] || 0,
      mouthPress: shapeMap['mouthPress'] || 0,
      
      // Mouth asymmetry
      mouthLeft: shapeMap['mouthLeft'] || 0,
      mouthRight: shapeMap['mouthRight'] || 0,
      mouthAsymmetry: Math.abs((shapeMap['mouthLeft'] || 0) - (shapeMap['mouthRight'] || 0)),
      
      // Cheek movements
      cheekPuff: shapeMap['cheekPuff'] || 0,
      cheekSquintLeft: shapeMap['cheekSquintLeft'] || 0,
      cheekSquintRight: shapeMap['cheekSquintRight'] || 0,
      cheekSquint: ((shapeMap['cheekSquintLeft'] || 0) + (shapeMap['cheekSquintRight'] || 0)) / 2,
      
      // Nose
      noseSneerLeft: shapeMap['noseSneerLeft'] || 0,
      noseSneerRight: shapeMap['noseSneerRight'] || 0,
      noseSneer: ((shapeMap['noseSneerLeft'] || 0) + (shapeMap['noseSneerRight'] || 0)) / 2,
    };

    // Calculate weighted confidence scores for each emotion
    const scores = {
      happy: 0,
      sad: 0,
      angry: 0,
      surprised: 0,
      fearful: 0,
      disgusted: 0,
      neutral: 0
    };

    // HAPPY (Duchenne Smile: AU6 + AU12)
    // Strong indicators: smile + cheek raise + eye squint
    if (features.smile > 0.3) {
      scores.happy += features.smile * 3; // Primary indicator
      if (features.cheekSquint > 0.15) scores.happy += features.cheekSquint * 2; // Genuine smile
      if (features.eyeSquint > 0.1) scores.happy += features.eyeSquint * 1.5; // Crow's feet
      // Penalize conflicting expressions
      if (features.browDown > 0.2) scores.happy -= 0.5;
      if (features.frown > 0.15) scores.happy -= 0.5;
    }

    // SAD (AU1 + AU4 + AU15)
    // Inner brow raise + brow down + lip corner down
    if (features.browInnerUp > 0.3 || features.frown > 0.2) {
      if (features.browInnerUp > 0.3) scores.sad += features.browInnerUp * 2.5;
      if (features.frown > 0.15) scores.sad += features.frown * 2;
      // Stronger sadness with both indicators
      if (features.browInnerUp > 0.4 && features.frown > 0.2) scores.sad += 1.0;
      // Slight jaw drop can indicate sadness
      if (features.jawOpen > 0.1 && features.jawOpen < 0.3) scores.sad += 0.3;
      // Penalize conflicting expressions
      if (features.smile > 0.2) scores.sad -= 0.8;
    }

    // ANGRY (AU4 + AU5 + AU7 + AU23)
    // Brow down + brow raise + eye squint + lips pressed
    if (features.browDown > 0.25 || features.eyeSquint > 0.3 || features.mouthPress > 0.3) {
      if (features.browDown > 0.25) scores.angry += features.browDown * 3;
      if (features.eyeSquint > 0.2) scores.angry += features.eyeSquint * 1.5;
      if (features.mouthClose > 0.3) scores.angry += features.mouthClose * 1.5;
      if (features.mouthPress > 0.3) scores.angry += features.mouthPress * 1.5;
      // Strong combo: brow down + lips pressed
      if (features.browDown > 0.3 && features.mouthClose > 0.4) scores.angry += 1.2;
      // Penalize conflicting expressions
      if (features.smile > 0.2) scores.angry -= 1.0;
      if (features.browInnerUp > 0.3) scores.angry -= 0.5;
    }

    // SURPRISED (AU1 + AU2 + AU5 + AU26)
    // Inner brow raise + outer brow raise + wide eyes + jaw drop
    if (features.eyeWide > 0.4 || (features.browOuterUp > 0.3 && features.jawOpen > 0.3)) {
      if (features.eyeWide > 0.4) scores.surprised += features.eyeWide * 2.5;
      if (features.browInnerUp > 0.25) scores.surprised += features.browInnerUp * 1.5;
      if (features.browOuterUp > 0.25) scores.surprised += features.browOuterUp * 1.5;
      if (features.jawOpen > 0.25) scores.surprised += features.jawOpen * 2;
      // Strong combo: wide eyes + raised brows + open mouth
      if (features.eyeWide > 0.5 && features.browOuterUp > 0.3 && features.jawOpen > 0.3) {
        scores.surprised += 1.5;
      }
      // Penalize if eyes are squinting (conflicting)
      if (features.eyeSquint > 0.2) scores.surprised -= 1.0;
    }

    // FEARFUL (AU1 + AU2 + AU4 + AU5 + AU20 + AU25/26)
    // Similar to surprised but with more tension
    if (features.browInnerUp > 0.35 && features.eyeWide > 0.3) {
      if (features.browInnerUp > 0.35) scores.fearful += features.browInnerUp * 2.5;
      if (features.eyeWide > 0.3) scores.fearful += features.eyeWide * 2;
      if (features.mouthStretchLeft > 0.2 || features.mouthStretchRight > 0.2) {
        scores.fearful += Math.max(features.mouthStretchLeft, features.mouthStretchRight) * 1.5;
      }
      if (features.mouthFunnel > 0.15) scores.fearful += features.mouthFunnel * 1.2;
      // Combination of raised inner brow + wide eyes + mouth tension
      if (features.browInnerUp > 0.4 && features.eyeWide > 0.4) scores.fearful += 1.0;
      // Penalize smile
      if (features.smile > 0.2) scores.fearful -= 0.8;
    }

    // DISGUSTED (AU9 + AU15 + AU16)
    // Nose wrinkle + lip corner down + lower lip down
    if (features.mouthUpperUp > 0.25 || features.noseSneer > 0.25) {
      if (features.mouthUpperUp > 0.25) scores.disgusted += features.mouthUpperUp * 3;
      if (features.noseSneer > 0.25) scores.disgusted += features.noseSneer * 2.5;
      if (features.mouthAsymmetry > 0.3) scores.disgusted += features.mouthAsymmetry * 1.5;
      if (features.mouthPucker > 0.25) scores.disgusted += features.mouthPucker * 1.2;
      // Strong nose wrinkle with upper lip raise
      if (features.mouthUpperUp > 0.35 && features.noseSneer > 0.2) scores.disgusted += 1.0;
      // Penalize smile
      if (features.smile > 0.2) scores.disgusted -= 0.8;
    }

    // Calculate neutral score (inverse of all expressions)
    const totalExpression = features.smile + features.frown + features.browDown + 
                           features.browInnerUp + features.eyeWide + features.eyeSquint +
                           features.mouthUpperUp + features.jawOpen * 0.5;
    
    scores.neutral = Math.max(0, 2.5 - (totalExpression * 3));
    
    // Boost neutral if face is very still
    if (totalExpression < 0.3) {
      scores.neutral += 1.5;
    }

    // Find the emotion with highest score
    let maxScore = 0;
    let detectedEmotion = 'neutral';
    
    Object.entries(scores).forEach(([emotion, score]) => {
      if (score > maxScore) {
        maxScore = score;
        detectedEmotion = emotion;
      }
    });

    // Require minimum confidence threshold
    const CONFIDENCE_THRESHOLD = 1.0;
    if (maxScore < CONFIDENCE_THRESHOLD) {
      return 'neutral';
    }

    return detectedEmotion;
  };

  // Smooth mood detection using temporal averaging
  const getSmoothedMood = (currentDetection) => {
    // Add current detection to history
    moodHistoryRef.current.push(currentDetection);
    
    // Keep only recent history
    if (moodHistoryRef.current.length > MOOD_HISTORY_LENGTH) {
      moodHistoryRef.current.shift();
    }
    
    // If we don't have enough history yet, return current detection
    if (moodHistoryRef.current.length < 5) {
      return currentDetection;
    }
    
    // Count occurrences of each mood in recent history
    const moodCounts = {};
    moodHistoryRef.current.forEach(mood => {
      moodCounts[mood] = (moodCounts[mood] || 0) + 1;
    });
    
    // Find the most common mood
    let maxCount = 0;
    let dominantMood = currentDetection;
    
    Object.entries(moodCounts).forEach(([mood, count]) => {
      if (count > maxCount) {
        maxCount = count;
        dominantMood = mood;
      }
    });
    
    // Require at least 40% consensus to change from neutral
    const threshold = moodHistoryRef.current.length * 0.4;
    if (dominantMood === 'neutral' || maxCount >= threshold) {
      return dominantMood;
    }
    
    // If no strong consensus, keep current mood
    return currentDetection;
  };

  // Real-time face detection and mood analysis
  const detectFaceAndMood = async () => {
    if (!faceLandmarker || !videoRef.current || !isWebcamActive) {
      if (!faceLandmarker) console.log('Waiting for face landmarker...');
      if (!videoRef.current) console.log('Waiting for video ref...');
      if (!isWebcamActive) console.log('Waiting for webcam to activate...');
      return;
    }

    const video = videoRef.current;
    
    // Check if video is ready to be processed
    if (video.readyState < 2) {
      console.log('Video not ready yet, readyState:', video.readyState);
      animationFrameRef.current = requestAnimationFrame(detectFaceAndMood);
      return;
    }
    
    // Check if video has valid dimensions
    if (!video.videoWidth || !video.videoHeight) {
      console.log('Video dimensions not available yet');
      animationFrameRef.current = requestAnimationFrame(detectFaceAndMood);
      return;
    }
    
    // Only process if video time has changed
    if (video.currentTime === lastVideoTimeRef.current) {
      animationFrameRef.current = requestAnimationFrame(detectFaceAndMood);
      return;
    }
    lastVideoTimeRef.current = video.currentTime;

    try {
      // Perform face detection
      const startTimeMs = performance.now();
      const results = faceLandmarker.detectForVideo(video, startTimeMs);

      // Analyze face for mood without drawing landmarks
      if (results.faceLandmarks && results.faceLandmarks.length > 0) {
        // Calculate mood from blendshapes
        if (results.faceBlendshapes) {
          const detectedMood = calculateMoodFromBlendshapes(results.faceBlendshapes);
          const smoothedMood = getSmoothedMood(detectedMood);
          setCurrentMood(smoothedMood);
          setDetectionStatus(`Detected: ${smoothedMood}${detectedMood !== smoothedMood ? ` (raw: ${detectedMood})` : ''}`);
        }
      } else {
        setDetectionStatus('No face detected');
      }
    } catch (error) {
      console.error('Detection error:', error);
      // Continue despite errors
    }

    // Continue detection loop
    animationFrameRef.current = requestAnimationFrame(detectFaceAndMood);
  };

  // Start webcam after model loads
  useEffect(() => {
    if (isModelLoaded && !isWebcamActive) {
      startWebcam();
    }
  }, [isModelLoaded]);

  // Start detection when model and webcam are ready
  useEffect(() => {
    if (isModelLoaded && isWebcamActive && faceLandmarker) {
      detectFaceAndMood();
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isModelLoaded, isWebcamActive, faceLandmarker]);

  // Add current mood to queue
  const addToQueue = () => {
    if (currentMood) {
      const newMood = {
        id: Date.now(),
        mood: currentMood,
        timestamp: new Date().toLocaleTimeString()
      };
      setMoodQueue(prev => [...prev, newMood]);
    }
  };

  // Remove mood from queue
  const removeFromQueue = (id) => {
    setMoodQueue(prev => prev.filter(item => item.id !== id));
  };

  // Play music for a specific mood
  const playMoodMusic = (mood) => {
    const searchQuery = moodToMusic[mood];
    // YouTube video ID would come from YouTube API search
    // For demo, using placeholder videos
    const videoIds = {
      happy: 'ZbZSe6N_BXs',
      sad: '4fezP875xOQ',
      angry: '4NRXx6U8ABQ',
      neutral: 'jfKfPfyJRdk',
      surprised: 'y6120QOlsfU',
      fearful: '1ZYbU82GVz4',
      disgusted: 'rog8ou-ZepE'
    };
    
    setCurrentVideo(videoIds[mood] || videoIds.neutral);
    setIsPlaying(true);
  };

  // Load YouTube IFrame API
  useEffect(() => {
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

    window.onYouTubeIframeAPIReady = () => {
      console.log('YouTube API Ready');
    };

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      // Stop webcam stream
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = videoRef.current.srcObject.getTracks();
        tracks.forEach(track => track.stop());
      }
    };
  }, []);

  // Auto-play current mood music only if no song is currently playing
  useEffect(() => {
    if (currentMood && isWebcamActive && !currentVideo) {
      playMoodMusic(currentMood);
    }
  }, [currentMood]);

  return (
    <div className="h-screen w-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-8 py-4 bg-black/30 backdrop-blur-sm border-b border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl">
              <Music className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Moodify</h1>
              <p className="text-xs text-gray-400">AI-Powered Mood Music</p>
            </div>
          </div>
          
          {/* Current Mood Indicator */}
          <div className={`px-6 py-2.5 rounded-full bg-gradient-to-r ${moodColors[currentMood]} shadow-lg`}>
            <p className="text-white font-semibold text-base capitalize">
              {currentMood}
            </p>
          </div>
        </div>
      </div>

      {/* Main Content - 3 Column Layout */}
      <div className="flex-1 flex gap-4 p-4 overflow-hidden">
        {/* Left Column - Webcam (Smaller) */}
        <div className="w-[30%] flex flex-col">
          <div className="flex-1 bg-black/40 backdrop-blur-md rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
            <div className="h-full flex flex-col">
              {/* Webcam Header */}
              <div className="px-4 py-3 bg-black/30 border-b border-white/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Camera className="w-4 h-4 text-purple-400" />
                    <span className="text-white font-medium text-sm">Live Camera</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                    <span className="text-xs text-gray-400">{detectionStatus}</span>
                  </div>
                </div>
              </div>

              {/* Webcam Feed */}
              <div className="flex-1 relative bg-black">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="absolute inset-0 w-full h-full object-cover"
                />
                
                {/* Mood Overlay - Simplified */}
                <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 to-transparent">
                  <div className="text-center">
                    <p className="text-gray-400 text-xs mb-1">Current Emotion</p>
                    <p className={`text-2xl font-bold capitalize bg-gradient-to-r ${moodColors[currentMood]} text-transparent bg-clip-text mb-3`}>
                      {currentMood}
                    </p>
                    <button
                      onClick={addToQueue}
                      className="w-full px-4 py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-xl font-medium shadow-lg transition-all transform hover:scale-105 flex items-center justify-center gap-2 text-sm"
                    >
                      <Plus className="w-4 h-4" />
                      Add to Queue
                    </button>
                  </div>
                </div>
                
                {/* Manual Start Camera Button */}
                {!isWebcamActive && isModelLoaded && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <button
                      onClick={startWebcam}
                      className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-2xl font-semibold shadow-2xl transition-all transform hover:scale-105 flex items-center gap-2"
                    >
                      <Camera className="w-5 h-5" />
                      Start Camera
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Middle Column - YouTube Player (Larger) */}
        <div className="w-[45%] flex flex-col">
          <div className="flex-1 bg-black/40 backdrop-blur-md rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
            <div className="h-full flex flex-col">
              {/* Player Header */}
              <div className="px-4 py-3 bg-black/30 border-b border-white/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Volume2 className="w-4 h-4 text-purple-400" />
                    <span className="text-white font-medium text-sm">Now Playing</span>
                  </div>
                  {isPlaying && (
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        <div className="w-1 h-3 bg-purple-400 rounded-full animate-pulse"></div>
                        <div className="w-1 h-3 bg-purple-400 rounded-full animate-pulse" style={{ animationDelay: '0.1s' }}></div>
                        <div className="w-1 h-3 bg-purple-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                      </div>
                      <span className="text-xs text-gray-400">Playing</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Player */}
              <div className="flex-1 bg-black relative">
                {currentVideo ? (
                  <iframe
                    ref={playerRef}
                    width="100%"
                    height="100%"
                    src={`https://www.youtube.com/embed/${currentVideo}?autoplay=1&mute=0`}
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="w-full h-full"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="text-center">
                      <Music className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                      <p className="text-gray-400">Waiting for mood detection...</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Queue (Better Design) */}
        <div className="w-[25%] flex flex-col">
          <div className="flex-1 bg-black/40 backdrop-blur-md rounded-2xl border border-white/10 overflow-hidden shadow-2xl flex flex-col">
            {/* Queue Header */}
            <div className="px-4 py-3 bg-black/30 border-b border-white/10 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Play className="w-4 h-4 text-purple-400" />
                  <span className="text-white font-medium text-sm">Mood Queue</span>
                </div>
                <span className="px-2 py-0.5 bg-purple-500/30 text-purple-300 text-xs rounded-full font-semibold">
                  {moodQueue.length}
                </span>
              </div>
            </div>

            {/* Queue Items - Scrollable */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
              {moodQueue.length === 0 ? (
                <div className="h-full flex items-center justify-center px-4">
                  <div className="text-center">
                    <div className="w-16 h-16 rounded-full bg-gray-800/50 flex items-center justify-center mx-auto mb-3">
                      <Music className="w-8 h-8 text-gray-600" />
                    </div>
                    <p className="text-gray-500 text-sm font-medium">No moods in queue</p>
                    <p className="text-gray-600 text-xs mt-1">Add your current mood to play music</p>
                  </div>
                </div>
              ) : (
                moodQueue.map((item, index) => (
                  <div
                    key={item.id}
                    className={`group p-3 bg-gradient-to-r ${moodColors[item.mood]} rounded-xl shadow-lg transition-all hover:scale-[1.02] cursor-pointer relative overflow-hidden`}
                    onClick={() => playMoodMusic(item.mood)}
                  >
                    {/* Background pattern */}
                    <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    
                    <div className="relative z-10">
                      <div className="flex items-start justify-between mb-1">
                        <div className="flex-1">
                          <p className="text-white font-bold capitalize text-base leading-tight">
                            {item.mood}
                          </p>
                          <p className="text-white/70 text-xs mt-0.5">
                            {item.timestamp}
                          </p>
                        </div>
                        <span className="text-white/60 text-xs font-semibold bg-black/20 px-2 py-0.5 rounded-full">
                          #{index + 1}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-1.5 mt-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            playMoodMusic(item.mood);
                          }}
                          className="flex-1 p-1.5 bg-white/20 hover:bg-white/30 rounded-lg transition-all text-center"
                          title="Play"
                        >
                          <Play className="w-3.5 h-3.5 text-white mx-auto" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFromQueue(item.id);
                          }}
                          className="flex-1 p-1.5 bg-white/20 hover:bg-red-500/50 rounded-lg transition-all text-center"
                          title="Remove"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-white mx-auto" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Custom Scrollbar Styles */}
      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.2);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(168, 85, 247, 0.4);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(168, 85, 247, 0.6);
        }
      `}</style>
    </div>
  );
};

export default MoodMusicApp;