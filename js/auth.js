async function hash(password){

const msg=new TextEncoder().encode(password)

const hash=await crypto.subtle.digest("SHA-256",msg)

return Array.from(new Uint8Array(hash))
.map(b=>b.toString(16).padStart(2,"0"))
.join("")

}

async function login(){

const email=document.getElementById("email").value
const pass=document.getElementById("password").value

const password=await hash(pass)
console.log('password', pass)
console.log('API_URL', API_URL)
fetch(API_URL,{

method:"POST",

body:JSON.stringify({

action:"login",
email:email,
password:pass
})

})

.then(res=>res.json())

.then(data=>{
console.log('data', data)
if(data.status=="success"){

localStorage.setItem("token",data.token)

window.location="dashboard.html"

}else{

alert("Invalid Login")

}

})

}