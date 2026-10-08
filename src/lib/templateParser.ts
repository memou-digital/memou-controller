/**
 * Template Parser & Serializer
 * Extracts and updates configurable properties in template files (script.js and index.html).
 */

export interface ConfigField {
  key: string;
  label: string;
  value: any;
  type: 'string' | 'object' | 'array' | 'number';
}

export interface PhotoSlot {
  id: string;
  src: string;
  alt: string;
  label: string;
  originalTag: string;
  isPlaceholder?: boolean;
}

/**
 * Extract config variable (e.g., BIRTHDAY_CONFIG) from script.js
 */
export function extractConfigFromScript(scriptContent: string): {
  varName: string;
  config: Record<string, any>;
  rawBlock: string;
} | null {
  const match = scriptContent.match(/(?:(?:const|let|var)\s+|window\.)([A-Z0-9_]*CONFIG)\s*=\s*(\{[\s\S]*?\n\};?)/);
  if (!match) return null;

  const varName = match[1];
  const rawBlock = match[2];
  // Remove the trailing semicolon
  let jsonLike = rawBlock.trim();
  if (jsonLike.endsWith(';')) {
    jsonLike = jsonLike.slice(0, -1);
  }

  try {
    // Safely evaluate JS object literal
    const configFn = new Function(`"use strict"; return (${jsonLike});`);
    const config = configFn();
    return {
      varName,
      config,
      rawBlock: match[0],
    };
  } catch (err) {
    console.error('Error parsing config block from script.js:', err);
    return null;
  }
}

/**
 * Replaces the config block in script.js with new serialized config
 */
export function updateScriptWithConfig(
  scriptContent: string,
  varName: string,
  newConfig: Record<string, any>
): string {
  const serialized = JSON.stringify(newConfig, null, 2);
  
  // Check if assigned on window.
  const windowRegex = new RegExp(`window\\.${varName}\\s*=\\s*\\{[\\s\\S]*?\\n\\};?`);
  if (windowRegex.test(scriptContent)) {
    return scriptContent.replace(windowRegex, `window.${varName} = ${serialized};`);
  }

  // Check if assigned with const/let/var
  const declRegex = new RegExp(`(?:const|let|var)\\s+${varName}\\s*=\\s*\\{[\\s\\S]*?\\n\\};?`);
  if (declRegex.test(scriptContent)) {
    return scriptContent.replace(declRegex, `const ${varName} = ${serialized};`);
  }

  return scriptContent;
}

/**
 * Extracts photo slots from index.html (both <img> tags and placeholder polaroid divs)
 */
export function extractPhotoSlots(htmlContent: string): PhotoSlot[] {
  const slots: PhotoSlot[] = [];
  let index = 1;

  // Match all <img> tags
  const imgRegex = /<img\s+([^>]*?)>/gi;
  let match: RegExpExecArray | null;

  while ((match = imgRegex.exec(htmlContent)) !== null) {
    const fullTag = match[0];
    const attrs = match[1];

    const srcMatch = attrs.match(/src=["']([^"']*)["']/i);
    const altMatch = attrs.match(/alt=["']([^"']*)["']/i);
    const idMatch = attrs.match(/id=["']([^"']*)["']/i);

    const src = srcMatch ? srcMatch[1] : '';
    const alt = altMatch ? altMatch[1] : '';
    const tagId = idMatch ? idMatch[1] : '';

    // Filter out dialog/modal dynamic preview images with empty src
    if (!src && tagId === 'dialogImg') continue;

    let label = alt || `Photo #${index}`;
    if (src.includes('spiderman-pointing')) label = 'Meme / Character Pointing Poster';
    else if (src.includes('spiderman-poster')) label = 'Hero Action Poster';
    else if (src.includes('spongebob_movie')) label = 'SpongeBob Movie Crew Art';
    else if (src.includes('spongebob_grid')) label = 'Cast 3x3 Grid Photo';
    else if (alt.toLowerCase().includes('memory')) label = alt;

    slots.push({
      id: `img_slot_${index}`,
      src,
      alt,
      label,
      originalTag: fullTag,
      isPlaceholder: false,
    });
    index++;
  }

  // Also check for SpongeBob style placeholder boxes (e.g. couple-box-1, couple-box-2)
  const couplePlaceholderRegex = /<div class="polaroid-img-wrap illustration-placeholder (couple-box-\d+)">[\s\S]*?<\/div>\s*<\/div>/gi;
  let phMatch: RegExpExecArray | null;
  let phIndex = 1;
  while ((phMatch = couplePlaceholderRegex.exec(htmlContent)) !== null) {
    slots.push({
      id: `placeholder_slot_${phIndex}`,
      src: '',
      alt: `Couple Memory Slot ${phIndex}`,
      label: `Polaroid Couple Slot ${phIndex} (Custom Photo)`,
      originalTag: phMatch[0],
      isPlaceholder: true,
    });
    phIndex++;
  }

  return slots;
}

/**
 * Replaces a photo slot in index.html with a new image src
 */
export function updatePhotoInHtml(
  htmlContent: string,
  slotId: string,
  newSrc: string,
  photoSlots: PhotoSlot[]
): string {
  const targetSlot = photoSlots.find((s) => s.id === slotId);
  if (!targetSlot) return htmlContent;

  if (targetSlot.isPlaceholder) {
    // Replace placeholder div with an actual <img> tag
    const replacement = `<div class="polaroid-img-wrap"><img src="${newSrc}" alt="${targetSlot.alt}" /></div>`;
    return htmlContent.replace(targetSlot.originalTag, replacement);
  } else {
    // Replace src inside the existing <img> tag
    const newTag = targetSlot.originalTag.replace(
      /src=["'][^"']*["']/i,
      `src="${newSrc}"`
    );
    return htmlContent.replace(targetSlot.originalTag, newTag);
  }
}

/**
 * Extract photo captions from index.html (matching elements with class photo-caption, polaroid-caption, or id photoCaptionX)
 */
export function extractPhotoCaptions(htmlContent: string): Record<string, string> {
  const captions: Record<string, string> = {};

  // 1. Match by id: id="photoCaption1", id="caption1", etc.
  const idRegex = /<[^>]*\bid=["'](?:photoCaption|caption)(\d+)["'][^>]*>([\s\S]*?)<\/[^>]+>/gi;
  let idMatch: RegExpExecArray | null;
  while ((idMatch = idRegex.exec(htmlContent)) !== null) {
    const num = idMatch[1];
    const text = idMatch[2].replace(/<[^>]*>/g, '').trim();
    if (text) {
      captions[`photoCaption${num}`] = text;
    }
  }

  // 2. Match by class: class="photo-caption" or class="polaroid-caption"
  const classRegex = /<p[^>]*\bclass=["'][^"']*(?:photo-caption|polaroid-caption)[^"']*["'][^>]*>([\s\S]*?)<\/p>/gi;
  let classMatch: RegExpExecArray | null;
  let idx = 1;
  while ((classMatch = classRegex.exec(htmlContent)) !== null) {
    const key = `photoCaption${idx}`;
    if (!captions[key]) {
      const text = classMatch[1].replace(/<[^>]*>/g, '').trim();
      if (text) {
        captions[key] = text;
      }
    }
    idx++;
  }

  return captions;
}

/**
 * Update photo captions in index.html
 */
export function updatePhotoCaptionsInHtml(
  htmlContent: string,
  config: Record<string, any>
): string {
  let updated = htmlContent;

  // 1. Update elements with explicit ID (id="photoCaption1", id="caption1", etc.)
  for (let i = 1; i <= 20; i++) {
    const val = config[`photoCaption${i}`] || config[`caption${i}`];
    if (typeof val === 'string' && val) {
      const idRegex = new RegExp(
        `(<[^>]*\\bid=["'](?:photoCaption|caption)${i}["'][^>]*>)([\\s\\S]*?)(<\\/[^>]+>)`,
        'gi'
      );
      if (idRegex.test(updated)) {
        updated = updated.replace(idRegex, `$1${val}$3`);
      }
    }
  }

  // 2. Also update ordered .photo-caption / .polaroid-caption paragraphs
  let pIdx = 1;
  updated = updated.replace(
    /(<p[^>]*\bclass=["'][^"']*(?:photo-caption|polaroid-caption)[^"']*["'][^>]*>)([\s\S]*?)(<\/p>)/gi,
    (match, openTag, oldContent, closeTag) => {
      const key = `photoCaption${pIdx}`;
      const fallbackKey = `caption${pIdx}`;
      pIdx++;
      const val = config[key] !== undefined ? config[key] : config[fallbackKey];
      if (typeof val === 'string') {
        return `${openTag}${val}${closeTag}`;
      }
      return match;
    }
  );

  return updated;
}

/**
 * Update the <title> tag in index.html
 */
export function updateHtmlTitle(htmlContent: string, newTitle: string): string {
  return htmlContent.replace(/<title>[\s\S]*?<\/title>/i, `<title>${newTitle}</title>`);
}

/**
 * Extract the <title> tag from index.html
 */
export function extractHtmlTitle(htmlContent: string): string {
  const match = htmlContent.match(/<title>(.*?)<\/title>/i);
  return match ? match[1] : '';
}

export interface AudioTrackInfo {
  src: string;
  name: string;
  hasTag: boolean;
  isYouTube?: boolean;
  youtubeId?: string;
}

/**
 * Extract 11-char YouTube Video ID from any YouTube URL (watch, youtu.be, music.youtube.com, embed)
 */
export function extractYouTubeId(url: string): string | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  const match = trimmed.match(
    /(?:youtu\.be\/|(?:[a-zA-Z0-9-]+\.)?youtube(?:-nocookie)?\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/i
  );
  if (match && match[1]) return match[1];
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  return null;
}

/**
 * Inject YouTube Background Music Engine into index.html
 */
export function injectYouTubeAudioInHtml(htmlContent: string, youtubeId: string): string {
  // Remove previous YouTube and Local snippets if any
  const cleanHtml = htmlContent
    .replace(/<!-- MEMOu YouTube Background Audio Engine -->[\s\S]*?<!-- \/MEMOu YouTube Background Audio Engine -->/gi, '')
    .replace(/<!-- MEMOu Local Background Audio Engine -->[\s\S]*?<!-- \/MEMOu Local Background Audio Engine -->/gi, '');

  const snippet = `<!-- MEMOu YouTube Background Audio Engine -->
  <div id="ytBgmContainer" style="position:fixed;bottom:0;right:0;width:200px;height:120px;z-index:-9999;opacity:0.001;pointer-events:none;overflow:hidden;">
    <div id="ytPlayer"></div>
  </div>
  <script>
    window.MEMOU_YT_ID = "${youtubeId}";
  </script>
  <script src="https://www.youtube.com/iframe_api"></script>
  <script>
    (function() {
      // Disable any conflicting chiptune/synthesizer engines from legacy templates
      if (window.RomanticAudioEngine) {
        window.RomanticAudioEngine.prototype.startBGM = function() {};
        window.RomanticAudioEngine.prototype.toggleBGM = function() {};
      }
      if (window.GraduationAudioEngine) {
        window.GraduationAudioEngine.prototype.startBGM = function() {};
        window.GraduationAudioEngine.prototype.toggleBGM = function() {};
      }
      window.__memouDisableSynthBgm = true;

      // Silence any existing HTML5 audio tags so they don't overlap
      var htmlAudios = document.querySelectorAll('audio');
      htmlAudios.forEach(function(a) {
        try { a.pause(); a.src = ''; a.volume = 0; } catch(e) {}
      });

      var ytPlayer = null;
      var isYtReady = false;
      var userWantsPlay = false;

      function initYt() {
        if (ytPlayer) return;
        var pVars = {
          autoplay: 0,
          loop: 1,
          playlist: window.MEMOU_YT_ID,
          controls: 0,
          disablekb: 1,
          fs: 0,
          playsinline: 1,
          rel: 0,
          enablejsapi: 1
        };
        try {
          if (window.location && window.location.origin && window.location.origin !== 'null') {
            pVars.origin = window.location.origin;
          }
        } catch(e) {}

        ytPlayer = new YT.Player('ytPlayer', {
          height: '120',
          width: '200',
          videoId: window.MEMOU_YT_ID,
          playerVars: pVars,
          events: {
            onReady: function(e) {
              isYtReady = true;
              if (userWantsPlay) {
                tryPlayYt();
              }
            },
            onStateChange: function(e) {
              var isPlaying = e.data === 1;
              updateToggleVisuals(isPlaying);
              if (isPlaying) {
                removeUnlock();
              }
              var bgm = document.getElementById('bgm') || document.getElementById('bgMusic') || document.getElementById('memouBgm');
              if (bgm) {
                if (isPlaying) bgm.dispatchEvent(new Event('play'));
                else bgm.dispatchEvent(new Event('pause'));
              }
            }
          }
        });
      }

      if (window.YT && window.YT.Player) {
        initYt();
      } else {
        window.onYouTubeIframeAPIReady = initYt;
      }

      function tryPlayYt() {
        userWantsPlay = true;
        if (ytPlayer && typeof ytPlayer.playVideo === 'function') {
          try {
            if (typeof ytPlayer.unMute === 'function') ytPlayer.unMute();
            if (typeof ytPlayer.setVolume === 'function') ytPlayer.setVolume(70);
            ytPlayer.playVideo();
          } catch(e) {}
        }
      }

      function pauseYt() {
        userWantsPlay = false;
        if (ytPlayer && typeof ytPlayer.pauseVideo === 'function') {
          try { ytPlayer.pauseVideo(); } catch(e) {}
        }
      }

      function toggleYt() {
        if (ytPlayer && typeof ytPlayer.getPlayerState === 'function') {
          var st = ytPlayer.getPlayerState();
          if (st === 1) pauseYt();
          else tryPlayYt();
        } else {
          if (userWantsPlay) pauseYt();
          else tryPlayYt();
        }
      }

      function updateToggleVisuals(isPlaying) {
        var toggleButtons = [
          'musicToggle', 'musicToggleBtn', 'soundToggleBtn', 'bgmBtn', 'audioToggle'
        ];
        toggleButtons.forEach(function(id) {
          var btn = document.getElementById(id);
          if (btn) {
            if (isPlaying) {
              btn.classList.remove('paused');
              btn.classList.add('active');
            } else {
              btn.classList.add('paused');
              btn.classList.remove('active');
            }
          }
        });
        var stateText = document.getElementById('musicState');
        if (stateText) stateText.textContent = isPlaying ? 'sound on' : 'sound off';
      }

      // Unlock YouTube audio on user interaction anywhere on page (retries until playing)
      function removeUnlock() {
        document.removeEventListener('click', unlock);
        document.removeEventListener('touchstart', unlock);
        document.removeEventListener('pointerdown', unlock);
      }
      function unlock() {
        tryPlayYt();
      }
      document.addEventListener('click', unlock, { passive: true });
      document.addEventListener('touchstart', unlock, { passive: true });
      document.addEventListener('pointerdown', unlock, { passive: true });

      // Proxy HTML5 audio methods to YouTube player for existing template scripts
      document.addEventListener('DOMContentLoaded', function() {
        var bgm = document.getElementById('bgm') || document.getElementById('bgMusic');
        if (bgm) {
          bgm.play = function() {
            tryPlayYt();
            return Promise.resolve();
          };
          bgm.pause = function() {
            pauseYt();
          };
          try {
            Object.defineProperty(bgm, 'paused', {
              get: function() {
                if (!ytPlayer || typeof ytPlayer.getPlayerState !== 'function') return !userWantsPlay;
                return ytPlayer.getPlayerState() !== 1;
              },
              configurable: true
            });
          } catch(err) {}
        }

        // Intercept entrance buttons
        var startButtons = [
          'openSurprise', 'enterSiteBtn', 'openEnvelopeBtn', 'startCelebrationBtn',
          'enterCityBtn', 'openBtn', 'startBtn', 'startGame', 'unwrapBtn'
        ];
        startButtons.forEach(function(id) {
          var el = document.getElementById(id);
          if (el) {
            el.addEventListener('click', function() {
              setTimeout(tryPlayYt, 200);
            });
          }
        });

        // Intercept music toggle buttons
        var toggleButtons = [
          'musicToggle', 'musicToggleBtn', 'soundToggleBtn', 'bgmBtn', 'audioToggle'
        ];
        toggleButtons.forEach(function(id) {
          var btn = document.getElementById(id);
          if (btn) {
            btn.addEventListener('click', function(e) {
              e.stopImmediatePropagation();
              toggleYt();
            }, true);
          }
        });
      });
    })();
  </script>
<!-- /MEMOu YouTube Background Audio Engine -->`;

  if (cleanHtml.includes('</body>')) {
    return cleanHtml.replace('</body>', `${snippet}\n</body>`);
  }
  return cleanHtml + '\n' + snippet;
}

/**
 * Extract audio track from index.html and/or script.js config
 */
export function extractAudioTrack(
  htmlContent: string,
  scriptConfig?: Record<string, any> | null
): AudioTrackInfo | null {
  // 1. Check for embedded YouTube background audio snippet
  const ytMatch = htmlContent.match(/window\.MEMOU_YT_ID\s*=\s*["']([^"']*)["']/i);
  if (ytMatch && ytMatch[1]) {
    const yId = ytMatch[1];
    return {
      src: `https://www.youtube.com/watch?v=${yId}`,
      name: `YouTube Audio (${yId})`,
      hasTag: true,
      isYouTube: true,
      youtubeId: yId,
    };
  }

  // 2. Check for MEMOu Local Background Audio Engine
  const memouLocalMatch = htmlContent.match(/<audio[^>]*id=["']memouBgm["'][^>]*src=["']([^"']*)["']/i) ||
                          htmlContent.match(/<audio[^>]*id=["']memouBgm["'][^>]*>[\s\S]*?<source[^>]*src=["']([^"']*)["']/i);
  if (memouLocalMatch && memouLocalMatch[1]) {
    const src = memouLocalMatch[1];
    const name = src.split('/').pop() || src;
    return { src, name, hasTag: true, isYouTube: false };
  }

  // 3. Check <audio ...><source src="..." ...></audio>
  const audioSourceRegex = /<audio[^>]*>[\s\S]*?<source\s+[^>]*src=["']([^"']*)["'][^>]*>[\s\S]*?<\/audio>/i;
  const sourceMatch = htmlContent.match(audioSourceRegex);
  if (sourceMatch && sourceMatch[1]) {
    const src = sourceMatch[1];
    const yId = extractYouTubeId(src);
    const name = src.split('/').pop() || src;
    return { src, name, hasTag: true, isYouTube: !!yId, youtubeId: yId || undefined };
  }

  // 4. Check <audio ... src="..." ...>
  const audioTagRegex = /<audio\s+[^>]*src=["']([^"']*)["'][^>]*>/i;
  const audioMatch = htmlContent.match(audioTagRegex);
  if (audioMatch && audioMatch[1]) {
    const src = audioMatch[1];
    const yId = extractYouTubeId(src);
    const name = src.split('/').pop() || src;
    return { src, name, hasTag: true, isYouTube: !!yId, youtubeId: yId || undefined };
  }

  // 5. Check for empty <audio ...> tag
  const emptyAudioRegex = /<audio\s+[^>]*id=["'](?:bgm|bgMusic|music|audio)["'][^>]*>/i;
  const hasEmptyAudio = emptyAudioRegex.test(htmlContent);

  // 6. Fallback: check config in script.js or config.js
  if (scriptConfig) {
    const musicField =
      scriptConfig.music ||
      scriptConfig.bgm ||
      scriptConfig.audio ||
      scriptConfig.soundTrack ||
      scriptConfig.song;
    if (typeof musicField === 'string' && musicField.trim()) {
      const yId = extractYouTubeId(musicField);
      return {
        src: musicField,
        name: yId ? `YouTube (${yId})` : musicField.split('/').pop() || musicField,
        hasTag: hasEmptyAudio,
        isYouTube: !!yId,
        youtubeId: yId || undefined,
      };
    }
  }

  if (hasEmptyAudio) {
    return { src: '', name: '', hasTag: true };
  }

  return null;
}

/**
 * Update audio source in index.html (supports local audio and YouTube links)
 */
export function updateAudioInHtml(htmlContent: string, newSrc: string): string {
  const ytId = extractYouTubeId(newSrc);
  if (ytId) {
    return injectYouTubeAudioInHtml(htmlContent, ytId);
  }

  // Remove previous YouTube and Local snippets if any
  let cleanHtml = htmlContent
    .replace(/<!-- MEMOu YouTube Background Audio Engine -->[\s\S]*?<!-- \/MEMOu YouTube Background Audio Engine -->/gi, '')
    .replace(/<!-- MEMOu Local Background Audio Engine -->[\s\S]*?<!-- \/MEMOu Local Background Audio Engine -->/gi, '');

  let mime = 'audio/mpeg';
  if (newSrc.endsWith('.m4a') || newSrc.endsWith('.mp4')) mime = 'audio/mp4';
  else if (newSrc.endsWith('.wav')) mime = 'audio/wav';
  else if (newSrc.endsWith('.ogg')) mime = 'audio/ogg';
  else if (newSrc.endsWith('.aac')) mime = 'audio/aac';

  // If any template <audio> tag exists, update its src attribute and inner <source> cleanly
  if (/<audio/i.test(cleanHtml)) {
    cleanHtml = cleanHtml.replace(/<audio\s+([^>]*?)>([\s\S]*?)<\/audio>/gi, (match, attrs) => {
      const cleanAttrs = attrs.replace(/\s*src=["'][^"']*["']/gi, '').trim();
      return `<audio ${cleanAttrs} src="${newSrc}" loop preload="auto">\n    <source src="${newSrc}" type="${mime}">\n  </audio>`;
    });
  }

  // Inject MEMOu Universal Local Background Audio Engine to guarantee playback on all templates
  const localEngineSnippet = `<!-- MEMOu Local Background Audio Engine -->
  <audio id="memouBgm" src="${newSrc}" loop preload="auto" style="display:none;">
    <source src="${newSrc}" type="${mime}">
  </audio>
  <script>
    (function() {
      // Disable any conflicting chiptune/synthesizer engines from legacy templates
      if (window.RomanticAudioEngine) {
        window.RomanticAudioEngine.prototype.startBGM = function() {};
        window.RomanticAudioEngine.prototype.toggleBGM = function() {};
      }
      if (window.GraduationAudioEngine) {
        window.GraduationAudioEngine.prototype.startBGM = function() {};
        window.GraduationAudioEngine.prototype.toggleBGM = function() {};
      }
      window.__memouDisableSynthBgm = true;

      var bgm = document.getElementById('memouBgm') || document.getElementById('bgMusic') || document.getElementById('bgm');
      if (!bgm) return;
      bgm.src = "${newSrc}";

      function playAudio() {
        if (!bgm) return;
        bgm.volume = 0.6;
        var p = bgm.play();
        if (p && typeof p.then === 'function') {
          p.then(function() {
            removeUnlock();
          }).catch(function(e) {
            console.debug('MEMOu Audio autoplay blocked, waiting user tap:', e);
          });
        }
      }

      // Unlock audio on user interaction anywhere on page (retries until playing)
      function removeUnlock() {
        document.removeEventListener('click', unlock);
        document.removeEventListener('touchstart', unlock);
        document.removeEventListener('pointerdown', unlock);
      }
      function unlock() {
        playAudio();
      }
      document.addEventListener('click', unlock, { passive: true });
      document.addEventListener('touchstart', unlock, { passive: true });
      document.addEventListener('pointerdown', unlock, { passive: true });

      // Intercept all known template interaction & entrance buttons
      var startButtons = [
        'openSurprise', 'enterSiteBtn', 'openEnvelopeBtn', 'startCelebrationBtn',
        'enterCityBtn', 'openBtn', 'startBtn', 'startGame', 'unwrapBtn'
      ];
      startButtons.forEach(function(id) {
        var el = document.getElementById(id);
        if (el) {
          el.addEventListener('click', function() {
            setTimeout(playAudio, 150);
          });
        }
      });

      // Intercept all known template music toggle buttons
      var toggleButtons = [
        'musicToggle', 'musicToggleBtn', 'soundToggleBtn', 'bgmBtn', 'audioToggle'
      ];
      toggleButtons.forEach(function(id) {
        var btn = document.getElementById(id);
        if (btn) {
          btn.addEventListener('click', function(e) {
            e.stopImmediatePropagation();
            if (bgm.paused) {
              playAudio();
              btn.classList.remove('paused');
              btn.classList.add('active');
            } else {
              bgm.pause();
              btn.classList.add('paused');
              btn.classList.remove('active');
            }
          }, true);
        }
      });
    })();
  </script>
<!-- /MEMOu Local Background Audio Engine -->`;

  if (cleanHtml.includes('</body>')) {
    return cleanHtml.replace('</body>', `${localEngineSnippet}\n</body>`);
  }

  return cleanHtml + '\n' + localEngineSnippet;
}

/**
 * Update audio/music property in script.js and config.js if present
 */
export function updateScriptWithAudio(scriptContent: string, newSrc: string): string {
  let updated = scriptContent;
  const patterns = [
    /(music\s*:\s*["'])([^"']*)(["'])/gi,
    /(bgm\s*:\s*["'])([^"']*)(["'])/gi,
    /(audio\s*:\s*["'])([^"']*)(["'])/gi,
    /(soundTrack\s*:\s*["'])([^"']*)(["'])/gi,
    /(song\s*:\s*["'])([^"']*)(["'])/gi,
  ];

  for (const p of patterns) {
    if (p.test(updated)) {
      updated = updated.replace(p, `$1${newSrc}$3`);
    }
  }

  return updated;
}
