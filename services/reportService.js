const fs = require("fs");

class ReportService {

    generate(invoices, fileName = "invoice_report.html") {

        const totalAmount = invoices.reduce(
            (sum, inv) => sum + Number(inv.totalAmount),
            0
        );

        const totalVAT = invoices.reduce(
            (sum, inv) => sum + Number(inv.vatAmount),
            0
        );

        const clients = {};

        invoices.forEach(invoice => {

            if (!clients[invoice.clientName]) {
                clients[invoice.clientName] = [];
            }

            clients[invoice.clientName].push(invoice);

        });

        const currency =
            invoices.length > 0
                ? invoices[0].currency
                : "AED";

        const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Invoice Report</title>

<style>

body{

font-family:Arial;
background:#f5f5f5;
margin:20px;

}

.container{

background:#fff;
padding:20px;
border-radius:8px;

}

table{

width:100%;
border-collapse:collapse;
margin-top:20px;

}

th{

background:#0066cc;
color:white;
padding:10px;

}

td{

padding:10px;
border-bottom:1px solid #ddd;

}

.summary{

display:flex;
gap:20px;
margin-bottom:20px;

}

.card{

background:#fafafa;
padding:15px;
border-left:5px solid #0066cc;

}

</style>

</head>

<body>

<div class="container">

<h1>Invoice Report</h1>

<p>${new Date().toLocaleString()}</p>

<div class="summary">

<div class="card">

<h3>Total Invoices</h3>

<h2>${invoices.length}</h2>

</div>

<div class="card">

<h3>Total Amount</h3>

<h2>${currency} ${totalAmount.toFixed(2)}</h2>

</div>

<div class="card">

<h3>Total VAT</h3>

<h2>${totalVAT.toFixed(2)}</h2>

</div>

<div class="card">

<h3>Clients</h3>

<h2>${Object.keys(clients).length}</h2>

</div>

</div>

<table>

<thead>

<tr>

<th>Client</th>
<th>Invoice</th>
<th>Date</th>
<th>Description</th>
<th>Subtotal</th>
<th>VAT</th>
<th>Total</th>

</tr>

</thead>

<tbody>

${invoices.map(inv=>`

<tr>

<td>${inv.clientName}</td>

<td>${inv.invoiceNo}</td>

<td>${inv.invoiceDate}</td>

<td>${inv.description || (inv.lineItems || []).map(i => i.description).filter(Boolean).join("; ")}</td>

<td>${inv.currency} ${Number(inv.subtotal || 0).toFixed(2)}</td>

<td>${inv.vatRate ? inv.vatRate + "% " : ""}${Number(inv.vatAmount || 0).toFixed(2)}</td>

<td>${inv.currency} ${Number(inv.totalAmount).toFixed(2)}</td>

</tr>

`).join("")}

</tbody>

</table>

${invoices.some(inv => (inv.lineItems || []).length > 0) ? `
<h2 style="margin-top:30px">Product / Service Details</h2>
<table>
<thead>
<tr>
<th>Invoice</th>
<th>Description</th>
<th>Qty</th>
<th>Unit Price</th>
<th>Amount</th>
</tr>
</thead>
<tbody>
${invoices.flatMap(inv => (inv.lineItems || []).map(item => `
<tr>
<td>${inv.invoiceNo}</td>
<td>${item.description || ""}</td>
<td>${item.quantity || 0}</td>
<td>${inv.currency} ${Number(item.unitPrice || 0).toFixed(2)}</td>
<td>${inv.currency} ${Number(item.amount || 0).toFixed(2)}</td>
</tr>
`)).join("")}
</tbody>
</table>
` : ""}

</div>

</body>

</html>
`;

        fs.writeFileSync(fileName, html);

        console.log(`✅ Report saved to ${fileName}`);

        return fileName;

    }

}

module.exports = new ReportService();