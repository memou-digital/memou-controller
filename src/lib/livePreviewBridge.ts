/**
 * MEMOu Live Preview Bridge
 * Injected into preview iframes (both GitHub cloud and local filesystem)
 * Enables real-time synchronization between the Studio editor and live preview.
 */

export function injectLiveBridgeToHtml(html: string, baseHref: string): string {
  // 1. Tag image elements with data-slot-id to match extractPhotoSlots
  let slotIndex = 1;
  let taggedHtml = html.replace(/<img\s+([^>]*?)>/gi, (match, attrs) => {
    const srcMatch = attrs.match(/src=["']([^"']*)["']/i);
    const idMatch = attrs.match(/id=["']([^"']*)["']/i);
    const src = srcMatch ? srcMatch[1] : '';
    const tagId = idMatch ? idMatch[1] : '';

    if (!src && tagId === 'dialogImg') return match;

    if (!attrs.includes('data-slot-id')) {
      const id = `img_slot_${slotIndex++}`;
      return `<img data-slot-id="${id}" ${attrs}>`;
    }
    slotIndex++;
    return match;
  });

  // 2. Tag polaroid placeholder elements with placeholder_slot_N
  let phIndex = 1;
  taggedHtml = taggedHtml.replace(
    /(<div\s+class=["'][^"']*polaroid-img-wrap illustration-placeholder[^"']*["'])([^>]*>)/gi,
    (match, openDiv, rest) => {
      const id = `placeholder_slot_${phIndex++}`;
      return `${openDiv} data-slot-id="${id}"${rest}`;
    }
  );

  // 3. Prepare base tag and bridge script
  const baseTag = `<base href="${baseHref}">`;
  const bridgeScript = `
<script id="memou-live-bridge">
(function() {
  if (window.__memouBridgeInstalled) return;
  window.__memouBridgeInstalled = true;

  // Handle messages from Studio Editor parent
  window.addEventListener('message', function(event) {
    if (!event.data || event.data.type !== 'MEMOU_LIVE_SYNC') return;
    applyLiveSync(event.data);
  });

  // Expose for direct same-origin parent access
  window.__memouApplyLiveSync = applyLiveSync;

  function applyLiveSync(payload) {
    try {
      var config = payload.config || {};
      var title = payload.title;
      var photoUpdates = payload.photoUpdates || [];
      var configVarName = payload.configVarName;
      var styleCss = payload.styleCss;

      // 1. Update Document Title
      if (title && typeof title === 'string') {
        document.title = title;
      }

      // 2. Real-time Live CSS Injection
      if (styleCss && typeof styleCss === 'string') {
        var styleEl = document.getElementById('memou-live-style');
        if (!styleEl) {
          styleEl = document.createElement('style');
          styleEl.id = 'memou-live-style';
          document.head.appendChild(styleEl);
        }
        styleEl.textContent = styleCss;
      }

      // 3. Update Global Script Config Objects
      var knownConfigVars = [
        configVarName,
        'BASIC_CONFIG',
        'DELUXE_CONFIG',
        'BIRTHDAY_CONFIG',
        'VALENTINE_CONFIG',
        'CONFIG',
        'MEMOU_CONFIG',
        'CUSTOM_CONFIG'
      ];
      knownConfigVars.forEach(function(varName) {
        if (varName && window[varName] && typeof window[varName] === 'object') {
          Object.assign(window[varName], config);
        }
      });

      // 4. Targeted DOM Elements Update (Idempotent single replacement)
      updateDomFields(config);

      // 5. Re-run Template Functions if defined
      var candidateFunctions = [
        'bindConfig',
        'initConfig',
        'buildMemories',
        'renderMemories',
        'renderKittyCouncil',
        'initPersonalizedData',
        'populateConfigData',
        'initLoveCounter',
        'renderDialogues',
        'initCastDialogues',
        'initBottleLetter',
        'initCakeCandles',
        'initLetter',
        'render',
        'init'
      ];
      candidateFunctions.forEach(function(fnName) {
        if (typeof window[fnName] === 'function') {
          try {
            window[fnName]();
          } catch(e) {
            console.debug('MEMOu Live: Re-run function ' + fnName + ' error:', e);
          }
        }
      });

      // 5b. If a memory detail modal is currently open, live-update its text
      var memModal = document.getElementById('memoryDetail');
      if (memModal && (memModal.classList.contains('show') || memModal.getAttribute('aria-hidden') === 'false')) {
        var numEl = document.getElementById('detailNumber');
        var curIdx = numEl ? parseInt(numEl.textContent, 10) - 1 : 0;
        var stories = config.castDialogues || config.memories;
        if (!isNaN(curIdx) && Array.isArray(stories) && stories[curIdx]) {
          var curItem = stories[curIdx];
          var titleEl = document.getElementById('detailTitle');
          var quoteEl = document.getElementById('detailQuote');
          if (titleEl && curItem.title !== undefined) titleEl.textContent = curItem.title;
          if (quoteEl && (curItem.quote !== undefined || curItem.text !== undefined)) {
            quoteEl.textContent = curItem.quote || curItem.text;
          }
        }
      }


      // 6. Photo Slots Immediate DOM Replacement
      if (Array.isArray(photoUpdates)) {
        photoUpdates.forEach(function(update) {
          if (!update || !update.newSrc) return;

          // Check by data-slot-id
          var targetEl = document.querySelector('[data-slot-id="' + update.slotId + '"]');
          if (targetEl) {
            if (targetEl.tagName === 'IMG') {
              targetEl.src = update.newSrc;
            } else {
              targetEl.innerHTML = '<img src="' + update.newSrc + '" class="w-full h-full object-cover rounded-lg" style="width:100%;height:100%;object-fit:cover;" />';
            }
            return;
          }

          // Check by ID
          var elById = document.getElementById(update.slotId) || document.getElementById('slot-' + update.slotId);
          if (elById) {
            if (elById.tagName === 'IMG') elById.src = update.newSrc;
            else elById.style.backgroundImage = 'url(' + update.newSrc + ')';
            return;
          }

          // Fallback check by img src matching slot id
          var allImgs = document.querySelectorAll('img');
          for (var i = 0; i < allImgs.length; i++) {
            var img = allImgs[i];
            var srcAttr = img.getAttribute('src') || '';
            if (srcAttr.includes(update.slotId) || img.src.includes(update.slotId)) {
              img.src = update.newSrc;
              break;
            }
          }
        });
      }

      // 7. Live Audio Update
      if (payload.audioSrc && typeof payload.audioSrc === 'string') {
        var newAudioSrc = payload.audioSrc;
        var isYt = newAudioSrc.indexOf('youtu') !== -1;
        if (isYt) {
          var curYt = window.MEMOU_YT_ID;
          var ytRegex = new RegExp('(?:youtu\\.be\\/|(?:[a-zA-Z0-9-]+\\.)?youtube(?:-nocookie)?\\.com\\/(?:embed\\/|v\\/|watch\\?v=|watch\\?.+&v=|shorts\\/))([\\w-]{11})', 'i');
          var match = newAudioSrc.match(ytRegex);
          var newYtId = match ? match[1] : '';
          if (newYtId && newYtId !== curYt) {
            window.location.reload();
          }
        } else {
          var bgmEls = [
            document.getElementById('memouBgm'),
            document.getElementById('bgm'),
            document.getElementById('bgMusic')
          ].filter(Boolean);
          bgmEls.forEach(function(el) {
            if (el && el.tagName === 'AUDIO') {
              var sourceEl = el.querySelector('source');
              if (sourceEl) sourceEl.src = newAudioSrc;
              if (el.getAttribute('src') !== newAudioSrc) {
                el.setAttribute('src', newAudioSrc);
                el.src = newAudioSrc;
                try { el.load(); } catch(e) {}
              }
            }
          });
        }
      }
    } catch(err) {
      console.warn('MEMOu Live Sync error:', err);
    }
  }

  function updateDomFields(config) {
    if (!config) return;

    var recipient = config.girlfriendName || config.recipientName || config.clientName;
    var sender = config.boyfriendName || config.senderName;
    var nickname = config.nickname || config.girlfriendNickname;
    var date = config.birthdayDate || config.eventDate || config.anniversaryDate;
    var subtitle = config.heroSubtitle || config.subtitle || config.heroDescription;
    var loveLetter = config.loveLetter || config.letterContent;
    var ticker = config.ticker;
    var finalMessage = config.finalMessage;

    // 1. Background Color
    if (config.backgroundColor) {
      document.documentElement.style.setProperty('--bg-page', config.backgroundColor);
      document.documentElement.style.setProperty('--bg-color', config.backgroundColor);
      document.documentElement.style.setProperty('--bg-warm', config.backgroundColor);
      if (document.body) {
        document.body.style.setProperty('background-color', config.backgroundColor, 'important');
      }
    }

    // 2. Element & Card Color
    if (config.elementColor) {
      document.documentElement.style.setProperty('--bg-surface', config.elementColor);
      document.documentElement.style.setProperty('--bg-subtle', config.elementColor);

      var elemHex = String(config.elementColor).replace('#', '').trim();
      if (elemHex.length === 3) elemHex = elemHex.split('').map(function(c) { return c + c; }).join('');
      if (elemHex.length === 6) {
        var eNum = parseInt(elemHex, 16);
        var eLum = 0.2126 * ((eNum >> 16) & 255) + 0.7152 * ((eNum >> 8) & 255) + 0.0722 * (eNum & 255);
        if (eLum < 130) {
          document.documentElement.style.setProperty('--rose-border', 'rgba(255, 255, 255, 0.15)');
          document.documentElement.style.setProperty('--gold-border', 'rgba(255, 255, 255, 0.2)');
        } else {
          document.documentElement.style.setProperty('--rose-border', 'rgba(179, 68, 90, 0.15)');
          document.documentElement.style.setProperty('--gold-border', 'rgba(196, 147, 90, 0.3)');
        }
      }
    }

    // 3. Text Color & Dynamic Contrast
    var bgHex = String(config.backgroundColor || '#FAF6F2').replace('#', '').trim();
    if (bgHex.length === 3) bgHex = bgHex.split('').map(function(c) { return c + c; }).join('');
    var bgLum = 255;
    if (bgHex.length === 6) {
      var bNum = parseInt(bgHex, 16);
      bgLum = 0.2126 * ((bNum >> 16) & 255) + 0.7152 * ((bNum >> 8) & 255) + 0.0722 * (bNum & 255);
    }

    var chosenTextColor = config.textColor || (bgLum < 130 ? '#FFFFFF' : '#331E23');
    document.documentElement.style.setProperty('--text-main', chosenTextColor);
    document.documentElement.style.setProperty('--text-body', chosenTextColor);

    if (bgLum < 130) {
      document.documentElement.style.setProperty('--text-muted', '#94A3B8');
      document.documentElement.style.setProperty('--rose-primary', '#FB7185');
      document.documentElement.classList.add('theme-dark-bg');
    } else {
      document.documentElement.style.setProperty('--text-muted', '#7E656A');
      document.documentElement.style.setProperty('--rose-primary', '#B3445A');
      document.documentElement.classList.remove('theme-dark-bg');
    }

    // Contrast check inside cards: ensure card text is legible against elementColor
    var curElem = config.elementColor || '#FFFFFF';
    var cHex = String(curElem).replace('#', '').trim();
    if (cHex.length === 3) cHex = cHex.split('').map(function(c) { return c + c; }).join('');
    if (cHex.length === 6) {
      var cNum = parseInt(cHex, 16);
      var cLum = 0.2126 * ((cNum >> 16) & 255) + 0.7152 * ((cNum >> 8) & 255) + 0.0722 * (cNum & 255);
      var cardTextEls = document.querySelectorAll('.memory-card .photo-caption, .letter-outer-card .letter-content, .header-tag-pill .event-tag, .hud-audio-btn, #soundToggleBtn');
      var cardInnerTextColor = (cLum < 130) ? (config.textColor || '#FFFFFF') : (bgLum < 130 && chosenTextColor === '#FFFFFF' ? '#331E23' : chosenTextColor);
      for (var ti = 0; ti < cardTextEls.length; ti++) {
        cardTextEls[ti].style.color = cardInnerTextColor;
      }
      var hudBtn = document.getElementById('soundToggleBtn') || document.querySelector('.hud-audio-btn');
      if (hudBtn) {
        hudBtn.style.backgroundColor = curElem;
        hudBtn.style.color = cardInnerTextColor;
      }
    }

    // Recipient Name (set exact string, never append or substring replace)
    if (recipient) {
      setText(['introQueenName', 'envelopeRecipientName', 'letterToName', 'certRecipientName', 'recipientName', 'girlfriendName', 'recipient-name', 'heroGirlName'], recipient);
      setText(['heroGirlfriendName'], nickname || recipient);
      setAllText('.recipient-name, .girlfriend-name, [data-field="recipientName"]', recipient);
    }

    // Sender Name
    if (sender) {
      setText(['letterSignoffName', 'letterSignature', 'certSignerName', 'boyfriendName', 'senderName', 'sender-name'], sender);
      setAllText('.sender-name, .boyfriend-name, [data-field="senderName"]', sender);
      var footerEl = document.getElementById('footerCreditText');
      if (footerEl && recipient) {
        footerEl.innerHTML = 'Crafted with 10,000% pure love by <strong>' + sender + '</strong> for <strong>' + recipient + '</strong>';
      }
    }

    // Nickname
    if (nickname) {
      setText(['nickname', 'girlfriendNickname', 'user-nickname', 'userNickname', 'letterNickname'], nickname);
      setText(['cakeName'], nickname.toUpperCase() + ' ♡');
      setText(['finalHeadline'], 'Happy Birthday, ' + nickname + '!');
      setAllText('.nickname, [data-field="nickname"]', nickname);
    }

    // Date
    if (date) {
      setText(['birthdayDate', 'eventDate', 'anniversaryDate', 'letterDate', 'certDateStr'], date);
      setAllText('.birthday-date, .event-date, .anniversary-date, [data-field="eventDate"]', date);
    }

    // Hero Subtitle
    if (subtitle) {
      setText(['heroSubtitle', 'hero-subtitle', 'heroDescription', 'subTitle'], subtitle);
      setAllText('.hero-subtitle, [data-field="heroSubtitle"]', subtitle);
    }

    // Marquee / Ticker
    if (ticker) {
      setText(['ticker', 'tickerText', 'marqueeText', 'bannerTicker'], ticker);
    }

    // Final Message
    if (finalMessage) {
      setText(['finalMessage'], finalMessage);
    }

    // Love Letter
    if (loveLetter) {
      setText(['loveLetter', 'letterContent', 'letterBody'], loveLetter);
      var fullLetterBody = document.getElementById('fullLetterBody');
      if (fullLetterBody) {
        fullLetterBody.innerHTML = '<p>' + loveLetter.replace(/\\n\\n/g, '</p><p>').replace(/\\n/g, '<br/>') + '</p>';
      }
    }

    // Photo Captions
    for (var ci = 1; ci <= 20; ci++) {
      var capVal = config['photoCaption' + ci] || config['caption' + ci];
      if (capVal !== undefined) {
        setText(['photoCaption' + ci, 'caption' + ci, 'photo-caption-' + ci], capVal);
        setAllText('[data-caption-id="' + ci + '"]', capVal);
      }
    }
    var captionEls = document.querySelectorAll('.photo-caption, .polaroid-caption');
    if (captionEls.length > 0) {
      captionEls.forEach(function(el, idx) {
        var cNum = idx + 1;
        var val = config['photoCaption' + cNum] || config['caption' + cNum] || (Array.isArray(config.photoCaptions) ? config.photoCaptions[idx] : null);
        if (val !== undefined && val !== null) {
          el.textContent = val;
        }
      });
    }

    // Cast Dialogues / Quotes
    if (config.castDialogues && typeof config.castDialogues === 'object') {
      Object.keys(config.castDialogues).forEach(function(charKey) {
        var d = config.castDialogues[charKey];
        if (!d) return;
        var quoteEl = document.querySelector('[data-char="' + charKey + '"] .dialogue-text, [data-char-quote="' + charKey + '"]');
        if (quoteEl && d.quote) quoteEl.textContent = d.quote;
      });
    }
  }

  function setText(ids, text) {
    if (!ids || text === undefined || text === null) return;
    ids.forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.textContent = text;
    });
  }

  function setAllText(selector, text) {
    if (!selector || text === undefined || text === null) return;
    try {
      var els = document.querySelectorAll(selector);
      for (var i = 0; i < els.length; i++) {
        els[i].textContent = text;
      }
    } catch(e) {}
  }

  // Announce bridge ready to parent
  try {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'MEMOU_LIVE_BRIDGE_READY' }, '*');
    }
  } catch(e) {}
})();
</script>
`;

  // Inject <base> and bridge script
  if (/<head[^>]*>/i.test(taggedHtml)) {
    return taggedHtml.replace(/<head[^>]*>/i, `$&${baseTag}${bridgeScript}`);
  } else {
    return `${baseTag}${bridgeScript}${taggedHtml}`;
  }
}

export function enhanceScriptForLiveSync(js: string): string {
  // 1. Transform top-level `const BIRTHDAY_CONFIG =` into `var BIRTHDAY_CONFIG = window.BIRTHDAY_CONFIG =`
  const enhanced = js.replace(
    /const\s+([A-Za-z0-9_]*CONFIG[A-Za-z0-9_]*)\s*=/g,
    'var $1 = window.$1 ='
  );

  // 2. Append safety exports to ensure all config vars and functions are accessible on window
  const bridgeSnippet = `
;try {
  if (typeof BASIC_CONFIG !== 'undefined') window.BASIC_CONFIG = BASIC_CONFIG;
  if (typeof BIRTHDAY_CONFIG !== 'undefined') window.BIRTHDAY_CONFIG = BIRTHDAY_CONFIG;
  if (typeof VALENTINE_CONFIG !== 'undefined') window.VALENTINE_CONFIG = VALENTINE_CONFIG;
  if (typeof DELUXE_CONFIG !== 'undefined') window.DELUXE_CONFIG = DELUXE_CONFIG;
  if (typeof CONFIG !== 'undefined') window.CONFIG = CONFIG;
  if (typeof MEMOU_CONFIG !== 'undefined') window.MEMOU_CONFIG = MEMOU_CONFIG;
  if (typeof bindConfig === 'function') window.bindConfig = bindConfig;
  if (typeof initConfig === 'function') window.initConfig = initConfig;
  if (typeof buildMemories === 'function') window.buildMemories = buildMemories;
  if (typeof renderMemories === 'function') window.renderMemories = renderMemories;
  if (typeof renderKittyCouncil === 'function') window.renderKittyCouncil = renderKittyCouncil;
  if (typeof populateConfigData === 'function') window.populateConfigData = populateConfigData;
  if (typeof initPersonalizedData === 'function') window.initPersonalizedData = initPersonalizedData;
  if (typeof initLoveCounter === 'function') window.initLoveCounter = initLoveCounter;
  if (typeof initCastDialogues === 'function') window.initCastDialogues = initCastDialogues;
  if (typeof initBottleLetter === 'function') window.initBottleLetter = initBottleLetter;
  if (typeof initLetter === 'function') window.initLetter = initLetter;
} catch(e) {}
`;

  return enhanced + bridgeSnippet;
}
