import { createVisualResourceRecovery } from './visual-resource-recovery.js';

export function releasePhotoSource(request) { request?.dispose(); }


/** Returns a clearable record so decoding cannot retain a closed dialog. */
export function loadPhotoSource(el, photoFullSrc, visibleImage) {
  const recovery = createVisualResourceRecovery({ host:el.querySelector('.cz-photo-paper') || el,
    source:photoFullSrc, floating:true, label:'原图暂未加载，当前预览已保留',
    isCurrent:() => el.isConnected && !el.classList.contains('cz-photo-closing') && visibleImage.isConnected,
    apply:image => {
      el.style.setProperty('--cz-photo-ratio', String(image.naturalWidth / image.naturalHeight));
      visibleImage.src = image.src;
    },
  });
  recovery.load();
  return recovery;
}
