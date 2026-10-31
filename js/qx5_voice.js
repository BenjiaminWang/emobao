// qx5_voice.js — 语音适配层（P0: system TTS + 降级；P1: 可注册 edge/azure）
window.QX5_VOICE = (function () {
    const engines = {
      system: {
        speak(text, cfg) {
          if (!window.speechSynthesis) return false;
          try {
            const u = new SpeechSynthesisUtterance(text);
            u.lang = 'zh-CN';
            u.rate = cfg?.rate ?? 1.0;
            u.pitch = cfg?.pitch ?? 1.0;
            u.volume = cfg?.volume ?? 1.0;
            // 中文 voice 选择：优先 zh-CN
            const voices = speechSynthesis.getVoices();
            const zh = voices.find(v => v.lang === 'zh-CN') || voices.find(v => v.lang.startsWith('zh'));
            if (zh) u.voice = zh;
            speechSynthesis.speak(u);
            return true;
          } catch { return false; }
        },
        cancel() { if (window.speechSynthesis) speechSynthesis.cancel(); }
      }
      // edge: { ... }  ← P1 注册，不动调用方
    };
    let current = 'system';
    return {
      setEngine(n) { if (engines[n]) current = n; },
      speak(text, charCfg) {
        // 降级：无 TTS / 静音 / 异常 → 返回 false，UI 只显示气泡
        if (!text || (charCfg && charCfg.muted)) return false;
        try { return engines[current].speak(text, charCfg); } catch { return false; }
      },
      cancel() { try { engines[current].cancel(); } catch {} }
    };
  })();
  
  // 角色语音参数（从 characters 读，P0 硬编码一份兜底）
  window.QX5_VOICE_CFG = {
    lin_manager: { rate: 1.0, pitch: 1.0, volume: 1.0 },
    xiaozhou:    { rate: 1.2, pitch: 1.3, volume: 1.0 },
    laok:        { rate: 0.95, pitch: 0.95, volume: 1.0 },
    wangjie:     { rate: 0.8,  pitch: 0.9,  volume: 1.0 },
    competitor:  { rate: 1.0,  pitch: 1.0,  volume: 1.0 }
  };