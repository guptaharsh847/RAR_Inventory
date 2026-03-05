function generate(){

const product=document.getElementById("product").value
const weight=document.getElementById("weight").value
const mrp=document.getElementById("mrp").value
const mfd=document.getElementById("mfd").value
const batch=document.getElementById("batch").value

const {Document,Packer,Paragraph}=docx

let children=[]

for(let i=0;i<65;i++){

children.push(

new Paragraph(

`${product}
Net Wt: ${weight}
MRP: ${mrp}
MFD: ${mfd}
Batch: ${batch}`

)

)

}

const doc=new Document({

sections:[{children}]

})

Packer.toBlob(doc).then(blob=>{

const a=document.createElement("a")
a.href=URL.createObjectURL(blob)
a.download="labels.docx"
a.click()

})

}   