function generate() {
  const weight = document.getElementById("weight").value;
  const mrp = document.getElementById("mrp").value;
  const mfd = document.getElementById("mfd").value;
  const batch = document.getElementById("batch").value;

  if (!weight || !mrp || !mfd || !batch) {
    showCustomAlert(
      "Please fill in all fields (Weight, MRP, MFD, and Batch No).",
      "Missing Information",
      "error",
    );
    return;
  }

  fetch("assets/labels2.docx")
    .then((res) => {
      if (!res.ok) {
        throw new Error(
          "Could not find labels2.docx template in the assets directory.",
        );
      }
      return res.arrayBuffer();
    })
    .then((content) => {
      const zip = new PizZip(content);
      const doc = new window.docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
      });

      doc.render({
        weight: weight,
        mrp: mrp,
        mfd: mfd,
        batch: batch,
      });

      const out = doc.getZip().generate({
        type: "blob",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });

      const a = document.createElement("a");
      a.href = URL.createObjectURL(out);
      a.download = `Labels.docx`;
      a.click();
    })
    .catch((error) => {
      console.error(error);
      showCustomAlert(
        "There was an issue generating your labels: " + error.message,
        "Generation Failed",
        "error",
      );
    });
}
