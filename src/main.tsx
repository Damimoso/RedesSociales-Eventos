import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

// Injected prefix for maplibre-gl worker – must be set BEFORE maplibre-gl loads
const _INJECTED_PREFIX = '(function(){var _ce=console.error;console.error=function(){var m=Array.prototype.map.call(arguments,String).join(" ");if(m.includes("Expected value to be of type number")||m.includes("/rpc/check_streak"))return;_ce.apply(console,arguments)};var _ae=self.addEventListener;self.addEventListener=function(t,l,o){if(t==="message"&&typeof l==="function"){var w=function(e){try{return l(e)}catch(ex){if(ex&&typeof ex.message==="string"&&ex.message.includes("Expected value to be of type number, but found null"))return;throw ex}};return _ae.call(self,t,w,o)}return _ae.apply(self,arguments)};var _om=null;Object.defineProperty(self,"onmessage",{get:function(){return _om},set:function(f){if(typeof f==="function"){_om=function(e){try{return f(e)}catch(ex){if(ex&&typeof ex.message==="string"&&ex.message.includes("Expected value to be of type number, but found null"))return;throw ex}}}else{_om=f}},configurable:true});self.onerror=function(e){if(e&&typeof e.message==="string"&&e.message.includes("Expected value to be of type number, but found null"))return true;return false};self.addEventListener("unhandledrejection",function(e){var r=e.reason;if(r&&typeof r.message==="string"&&r.message.includes("Expected value to be of type number, but found null")){e.preventDefault();try{e.promise.catch(function(){})}catch(ex){}}});})();'

class PatchedBlob extends Blob {
  constructor(parts?: BlobPart[], options?: BlobPropertyBag) {
    if (options?.type === 'text/javascript' && parts != null) {
      const newParts: BlobPart[] = []
      let alreadyPatched = false
      for (const p of parts) {
        if (typeof p === 'string' && p.includes('var _ce=console.error')) {
          alreadyPatched = true
        }
        newParts.push(p)
      }
      if (!alreadyPatched) {
        newParts.unshift(_INJECTED_PREFIX)
      }
      super(newParts, options)
    } else {
      super(parts, options)
    }
  }
}
window.Blob = PatchedBlob

// Dynamic import so maplibre-gl initialises AFTER Blob is patched
import('./App').then(({ default: App }) => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
