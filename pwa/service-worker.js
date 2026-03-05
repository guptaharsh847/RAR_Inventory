self.addEventListener("install",e=>{

e.waitUntil(

caches.open("ims-cache").then(cache=>{

return cache.addAll([
"/",
"/index.html",
"/css/style.css"
])

})

)

})