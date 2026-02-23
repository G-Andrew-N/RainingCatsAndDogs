import { useState, useEffect, useRef } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'motion/react';

interface AnimalDroplet {
  id: number;
  imageUrl: string;
  x: number;
  delay: number;
  duration: number;
  tilt: number;
  size: number;
  currentY?: number;
  createdAt?: number; // Track when the droplet was created
}

export default function App() {
  const [droplets, setDroplets] = useState<AnimalDroplet[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [selectedDroplet, setSelectedDroplet] = useState<AnimalDroplet | null>(null);
  const [previewPosition, setPreviewPosition] = useState({ x: 0, y: 0 });
  const [currentJoke, setCurrentJoke] = useState<{ setup: string; punchline: string } | null>(null);

  useEffect(() => {
    document.title = 'Raining cats and dogs';

    const currentUrl = window.location.href;

    const canonicalLink = document.getElementById('canonical-link');
    if (canonicalLink instanceof HTMLLinkElement) {
      canonicalLink.href = currentUrl;
    }

    const ogUrlMeta = document.getElementById('og-url');
    if (ogUrlMeta instanceof HTMLMetaElement) {
      ogUrlMeta.content = currentUrl;
    }
  }, []);

  const fetchAnimalImage = async (): Promise<string> => {
    try {
      const useDog = Math.random() > 0.5;
      let response;
      let data;

      if (useDog) {
        response = await fetch('https://dog.ceo/api/breeds/image/random', {
          mode: 'cors',
        });
        if (!response.ok) throw new Error('Dog API request failed');
        data = await response.json();
        if (data.status === 'success' && data.message) {
          return data.message;
        }
      } else {
        response = await fetch('https://api.thecatapi.com/v1/images/search', {
          mode: 'cors',
        });
        if (!response.ok) throw new Error('Cat API request failed');
        data = await response.json();
        if (data && data[0] && data[0].url) {
          return data[0].url;
        }
      }
      
      console.error('Invalid API response:', data);
      return '';
    } catch (err) {
      console.error('Failed to fetch animal image:', err);
      // Retry with the other API if one fails
      try {
        const useDog = Math.random() > 0.5;
        const fallbackResponse = await fetch(
          useDog 
            ? 'https://dog.ceo/api/breeds/image/random'
            : 'https://api.thecatapi.com/v1/images/search',
          { mode: 'cors' }
        );
        if (fallbackResponse.ok) {
          const fallbackData = await fallbackResponse.json();
          if (useDog && fallbackData.status === 'success' && fallbackData.message) {
            return fallbackData.message;
          }
          if (!useDog && fallbackData && fallbackData[0] && fallbackData[0].url) {
            return fallbackData[0].url;
          }
        }
      } catch (retryErr) {
        console.error('Retry also failed:', retryErr);
      }
      return '';
    }
  };

  const preloadImage = (url: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve();
      img.onerror = reject;
      img.src = url;
    });
  };

  const createDroplet = async () => {
    if (isPaused) return; // Don't create new droplets when paused
    
    const imageUrl = await fetchAnimalImage();
    if (!imageUrl) return;

    // Preload the image before showing the droplet
    try {
      await preloadImage(imageUrl);
    } catch (err) {
      console.error('Failed to load image:', err);
      return;
    }

    const newDroplet: AnimalDroplet = {
      id: Date.now() + Math.random(), // Generate unique ID
      imageUrl,
      x: Math.random() * 90, // Random horizontal position (0-90%)
      delay: 0,
      duration: 3 + Math.random() * 2, // Random duration between 3-5 seconds
      tilt: (Math.random() - 0.5) * 20, // Random slight tilt between -10 and 10 degrees
      size: 0.4 + Math.random() * 1.2, // Random size between 0.4-1.6x (creates depth)
      createdAt: Date.now(), // Track creation time
    };

    setDroplets((prev) => [...prev, newDroplet]);

    // Calculate the actual fall duration (same as in render)
    const actualFallDuration = newDroplet.duration * (2 - newDroplet.size * 0.5);
    
    // Remove droplet after animation completes, but only if not frozen
    setTimeout(() => {
      setDroplets((prev) => prev.filter((d) => {
        if (d.id !== newDroplet.id) return true; // Keep other droplets
        return d.currentY !== undefined; // Keep if frozen, remove if not
      }));
    }, actualFallDuration * 1000 + 500);
  };

  const handleDropletClick = (e: React.MouseEvent, droplet: AnimalDroplet) => {
    e.stopPropagation();
    
    // Capture current positions of all droplets before pausing
    const clickTime = Date.now();
    setDroplets((prev) => 
      prev.map((d) => {
        if (d.currentY !== undefined) return d; // Already frozen
        
        // Calculate elapsed time for this droplet using createdAt
        const size = d.size || 1;
        const fallDuration = d.duration * (2 - size * 0.5);
        const totalDuration = fallDuration * 1000; // in ms
        const elapsedTime = clickTime - (d.createdAt || clickTime);
        const progress = Math.min(elapsedTime / totalDuration, 1);
        
        // Calculate current Y position based on progress
        const targetY = window.innerHeight + 160;
        const currentY = progress * targetY;
        
        return { ...d, currentY };
      })
    );
    
    setIsPaused(true);
    setSelectedDroplet(droplet);
    
    // Fetch a random joke
    fetchJoke();
    
    // Position the preview intelligently to always be visible
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const previewWidth = 300;
    const previewHeight = 450; // Increased height to accommodate joke
    const padding = 20;
    
    let x = rect.right + padding; // Try right first
    let y = rect.top;
    
    // Check if preview fits on the right
    if (x + previewWidth > window.innerWidth) {
      // Try left side
      x = rect.left - previewWidth - padding;
      
      // If still doesn't fit, center it horizontally
      if (x < 0) {
        x = Math.max(padding, (window.innerWidth - previewWidth) / 2);
      }
    }
    
    // Ensure vertical positioning keeps preview visible
    if (y + previewHeight > window.innerHeight) {
      y = Math.max(padding, window.innerHeight - previewHeight - padding);
    }
    
    // Ensure it doesn't go above the viewport
    if (y < padding) {
      y = padding;
    }
    
    setPreviewPosition({ x, y });
  };

  const fetchJoke = async () => {
    try {
      const response = await fetch('https://official-joke-api.appspot.com/random_joke');
      const data = await response.json();
      if (data.setup && data.punchline) {
        setCurrentJoke({ setup: data.setup, punchline: data.punchline });
      }
    } catch (err) {
      console.error('Failed to fetch joke:', err);
      setCurrentJoke({ 
        setup: "Why don't cats play poker in the jungle?", 
        punchline: "Too many cheetahs!" 
      });
    }
  };

  const closePreview = () => {
    setIsPaused(false);
    setSelectedDroplet(null);
    // Clear frozen positions so droplets can continue falling
    setDroplets((prev) => prev.map((d) => ({ ...d, currentY: undefined })));
  };

  // Initial droplets on load
  useEffect(() => {
    const initialDroplets = async () => {
      for (let i = 0; i < 5; i++) {
        setTimeout(() => createDroplet(), i * 300);
      }
    };
    initialDroplets();
  }, []);

  // Continuously add new droplets
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isPaused) {
        createDroplet();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isPaused]);

  return (
    <div 
      className="h-screen w-screen overflow-hidden relative"
      onClick={createDroplet}
      style={{
        backgroundImage: 'url(https://images.unsplash.com/photo-1625234113933-d7a40a885337?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtZWFkb3clMjBkYXJrJTIwc3Rvcm0lMjBjbG91ZHN8ZW58MXx8fHwxNzcxODUxNDQzfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* Falling animal droplets */}
      {droplets.map((droplet) => {
        // Calculate depth-based properties with safe defaults
        const size = droplet.size || 1;
        const opacity = Math.max(0.85, Math.min(1, 0.85 + (size * 0.15))); // Smaller = slightly more transparent
        const blur = Math.max(0, (1.6 - size) * 0.5); // Reduced blur for clarity
        const shadowIntensity = size; // Smaller = less shadow
        const fallDuration = droplet.duration * (2 - size * 0.5); // Larger = faster
        
        return (
          <motion.div
            key={droplet.id}
            className="absolute -top-40 cursor-pointer"
            style={{
              left: `${droplet.x}%`,
              width: `${size * 128}px`,
              height: `${size * 160}px`,
              opacity,
              filter: blur > 0.3 ? `blur(${blur}px)` : 'none',
            }}
            initial={{ y: 0, rotate: droplet.tilt }}
            animate={{ 
              y: isPaused ? droplet.currentY : window.innerHeight + 160,
              rotate: droplet.tilt,
            }}
            transition={{
              duration: fallDuration,
              delay: droplet.delay,
              ease: "linear",
            }}
            onClick={(e) => handleDropletClick(e, droplet)}
          >
            <svg
              className="absolute inset-0 w-full h-full"
              viewBox="0 0 128 160"
            >
              <defs>
                <clipPath id={`droplet-clip-${droplet.id}`}>
                  <path d="M 64 160 C 38 160, 18 140, 18 110 C 18 80, 38 40, 64 0 C 90 40, 110 80, 110 110 C 110 140, 90 160, 64 160 Z" />
                </clipPath>
              </defs>
              <image
                href={droplet.imageUrl}
                x="0"
                y="0"
                width="128"
                height="160"
                preserveAspectRatio="xMidYMid slice"
                clipPath={`url(#droplet-clip-${droplet.id})`}
                style={{
                  filter: `drop-shadow(0 ${size * 10}px ${size * 20}px rgba(59, 130, 246, ${shadowIntensity * 0.5}))`,
                }}
              />
            </svg>
          </motion.div>
        );
      })}
      
      {/* Preview of selected droplet */}
      {selectedDroplet && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="fixed bg-white p-4 rounded-lg shadow-2xl z-50"
          style={{
            top: previewPosition.y,
            left: previewPosition.x,
            maxWidth: '300px',
          }}
        >
          <div className="relative">
            <img
              src={selectedDroplet.imageUrl}
              alt="Selected Animal"
              className="w-full h-64 object-cover rounded"
            />
            <button
              className="absolute top-2 right-2 bg-white/90 hover:bg-white text-gray-800 rounded-full w-8 h-8 flex items-center justify-center shadow-lg transition-colors"
              onClick={closePreview}
            >
              ✕
            </button>
          </div>
          {currentJoke && (
            <div className="mt-3 text-sm text-gray-600 text-center">
              <p className="font-bold">{currentJoke.setup}</p>
              <p className="mt-1">{currentJoke.punchline}</p>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}