/**
 * UAE Invoice Parser - Customized for Toqeer's Invoices
 * Handles Retail, Wholesale, Services, and Food invoices
 */

class UAEInvoiceParser {
  constructor() {
    this.invoiceTypes = {
      retail: 'Retail (Minimart/Shop)',
      wholesale: 'Wholesale/Food Trading',
      service: 'Services',
      gas: 'Gas/LPG Distribution',
      restaurant: 'Restaurant/Food Service',
    };

    this.uaePatterns = {
      // TRN Number (Tax Registration Number)
      trn: /TR[N\.]?\s*(?:No|Number)?\.?\s*:?\s*(\d{15})/i,
      vat: /VAT\s*(?:Registration)?\s*(?:Number)?\s*:?\s*(\d{15})/i,

      // Invoice/Reference Numbers - Handle all formats
      invoiceNo: [
        /Invoice\s*No\s*:?\s*([A-Z0-9\-\/]+?)(?:\s+Invoice|$)/i,
        /Invoice\s*(?:No|Number|ID)\s*:?\s*([0-9\-\/A-Z]+?)(?:\s|$)/i,
        /^Invoice\s*No:?([A-Z0-9\-\/]+)/im,
        /Invoice\s*No\s*:?\s*(\d{5,})/i,
        /No\.?\s*:?\s*(\d{5,})/i,
      ],
      
      // Client Name - Handle all formats including "Client:" prefix
      clientName: [
        /^Client\s*:?\s*([A-Z\s&\.\,]+?)(?=\s+(?:TRN|PHONE|Phone|Tel|Invoice))/im,
        /Client\s*:?\s*([A-Za-z\s&\.\,]+?)(?=\n|TRN|Phone|Tel)/i,
        /Mr\.\s*\/\s*Mls\s*:?\s*([A-Za-z\s&\.]+?)\s+(?=Date|Date|\n|Tel|Phone)/i,
        /Customer\s*Name\s*:?\s*([A-Za-z\s&\.]+?)\s+(?=Invoice|Phone|Tel|Customer TRN)/i,
        /Customer\s*Name\s*:?\s*([A-Za-z\s&\.]+?)$/im,
        /Bill[ing]?\s*To\s*:?\s*([A-Za-z\s&\.]+?)(?=\n|Phone|Address|Invoice)/i,
        /Buyer\s*:?\s*([A-Za-z\s&\.]+?)(?=\n|Phone|Invoice)/i,
      ],
      
      // Dates - Handle many formats including day names
      invoiceDate: [
        /Date\s*:?\s*(?:Saturday|Sunday|Monday|Tuesday|Wednesday|Thursday|Friday)?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
        /(?:Date|Dated|Invoice Date)\s*:?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
        /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})\s+\d{1,2}:\d{2}/i,
      ],
      dueDate: /(?:Due|Payment Due|Due Date)\s*:?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/i,
      
      // Phone Numbers (UAE format) - More specific patterns only!
      phoneUAE: [
        /Telephone\s*:?\s*(\+971[\d\s\-]{10,})/i,
        /(?:Phone|Tel|Mobile|Mob)\s*:?\s*(\+971\d[\d\s\-]{7,})/i,
        /(?:Phone|Tel)\s*:?\s*(\d{2}\s*\d{3,4}\s*\d{3,4})/i,
      ],
      
      // Location
      location: /(?:Location|Address|PO Box)\s*:?\s*([^\n]+?)(?=\n|Phone|Mobile|Date)/i,
      
      // Amounts - Multiple patterns to catch different formats (including Dhs/Fils)
      subtotal: [
        /Sub\s*Total\s*:?\s*([0-9,]+\.?\d*)/i,
        /Sub[- ]?Total\s*:?\s*([0-9,]+\.?\d*)\s*(?:AED|Dhs)?/i,
        /Total\s*(?:Dhs|Amount\s*Before\s*Tax)\s*:?\s*([0-9,]+\.?\d*)/i,
        /Subtotal\s*:?\s*([0-9,]+\.?\d*)/i,
        /Net\s*Total\s*:?\s*([0-9,]+\.?\d*)/i,
        /المجموع.*?([0-9,]+\.?\d*)/i,  // Arabic
      ],
      
      vatAmount: [
        /Vat\s+5%\s*:?\s*([0-9,]+\.?\d*)/i,
        /(?:VAT|Tax|TAX)\s*(?:Amount)?\s*(?:5%)?\s*:?\s*([0-9,]+\.?\d*)\s*(?:AED|Dhs)?/i,
        /ضريبة.*?([0-9,]+\.?\d*)/i,  // Arabic
      ],
      
      total: [
        /Grand\s*Total\s*(?:AED)?\s*:?\s*([0-9,\.]+)/i,  // Udayaa format
        /Net\s*Payable\s*\(AED\)\s*:?\s*([0-9,\.]+)/i,   // Udayaa format
        /Total\s*Amount\s*:?\s*([0-9,\.]+(?:\s*\/\s*[0-9]+)?)/i,  // Handle split format
        /Total\s*Amount\s*After\s*Tax\s*:?\s*([0-9,\.]+)/i,
        /(?:TOTAL|Total)\s*(?:PRICE|Amount|Invoice)?\s*:?\s*([0-9,]+\.?\d*)\s*(?:AED|Dhs)?/i,
        /Total\s*Amount\s*(?:After\s*Tax)?\s*:?\s*([0-9,]+\.?\d*)/i,
        /Net\s*Amount\s*:?\s*([0-9,]+\.?\d*)/i,
        /Total\s*(?:AED|Dhs)\s*:?\s*([0-9,]+\.?\d*)/i,
        /المبلغ.*?([0-9,]+\.?\d*)/i,  // Arabic
      ],
      
      // Line Items
      lineItem: /^(\d+)\s+(.+?)\s+(\d+)\s+([0-9,\.]+)\s+([0-9,\.]+)$/gm,
    };
  }

  /**
   * Extract all data from invoice text
   */
  extract(ocrText) {
    const invoice = {
      invoiceType: this.detectInvoiceType(ocrText),
      clientName: this.extractField(ocrText, 'clientName'),
      trn: this.extractField(ocrText, 'trn') || this.extractField(ocrText, 'vat'),
      invoiceNo: this.extractField(ocrText, 'invoiceNo'),
      invoiceDate: this.extractField(ocrText, 'invoiceDate'),
      dueDate: this.extractField(ocrText, 'dueDate'),
      phoneNumber: this.extractField(ocrText, 'phoneUAE'),
      location: this.extractField(ocrText, 'location'),
      subtotal: this.cleanAmount(this.extractField(ocrText, 'subtotal')),
      vatAmount: this.cleanAmount(this.extractField(ocrText, 'vatAmount')),
      totalAmount: this.cleanAmount(this.extractField(ocrText, 'total')),
      lineItems: this.extractLineItems(ocrText),
      currency: this.detectCurrency(ocrText),
      rawText: ocrText.substring(0, 300),
    };

    // Smart fallback: if total is 0, extract from last numbers in text
    if (parseFloat(invoice.totalAmount) === 0 || invoice.totalAmount === '0.00') {
      const numbers = ocrText.match(/(\d+(?:[.,]\d+)*)\s*(?:AED|Dhs)?[\s]*(?:\n|$)/g);
      if (numbers && numbers.length > 0) {
        const lastNumber = numbers[numbers.length - 1];
        invoice.totalAmount = this.cleanAmount(lastNumber);
      }
    }

    // Calculate missing amounts
    if (parseFloat(invoice.subtotal) > 0 && parseFloat(invoice.vatAmount) > 0 && parseFloat(invoice.totalAmount) === 0) {
      invoice.totalAmount = (parseFloat(invoice.subtotal) + parseFloat(invoice.vatAmount)).toFixed(2);
    }

    if (parseFloat(invoice.subtotal) > 0 && parseFloat(invoice.vatAmount) === 0 && parseFloat(invoice.totalAmount) > 0) {
      const vat = (parseFloat(invoice.totalAmount) - parseFloat(invoice.subtotal)).toFixed(2);
      if (parseFloat(vat) > 0) {
        invoice.vatAmount = vat;
      }
    }

    // If subtotal is 0 but total exists, assume subtotal = total
    if (parseFloat(invoice.subtotal) === 0 && parseFloat(invoice.totalAmount) > 0) {
      invoice.subtotal = invoice.totalAmount;
    }

    return invoice;
  }

  /**
   * Detect invoice type based on content
   */
  detectInvoiceType(text) {
    const lowerText = text.toLowerCase();

    // Check for specific keywords
    if (lowerText.includes('lpg') || lowerText.includes('cylinder') || lowerText.includes('adnoc')) {
      return 'gas';
    }
    if (lowerText.includes('food') || lowerText.includes('restaurant') || lowerText.includes('chicken') || lowerText.includes('dairy') || lowerText.includes('nafees')) {
      return 'wholesale';
    }
    if (lowerText.includes('veg') || lowerText.includes('fruit') || lowerText.includes('shop') || lowerText.includes('star')) {
      return 'retail';
    }
    if (lowerText.includes('restaurant') || lowerText.includes('hotel')) {
      return 'restaurant';
    }
    if (lowerText.includes('bayzco') || lowerText.includes('maintenance') || lowerText.includes('contractor')) {
      return 'service';
    }

    return 'unknown';
  }

  /**
   * Detect currency (AED or Dhs)
   */
  detectCurrency(text) {
    if (text.includes('AED')) return 'AED';
    if (text.includes('Dhs') || text.includes('Dh.')) return 'Dhs';
    return 'AED'; // Default
  }

  /**
   * Extract single field using regex - handles array of patterns
   */
  extractField(text, fieldType) {
    const patterns = this.uaePatterns[fieldType];
    if (!patterns) return '';

    // Handle array of patterns
    const patternArray = Array.isArray(patterns) ? patterns : [patterns];

    for (const pattern of patternArray) {
      const match = text.match(pattern);
      if (match && match[1]) {
        let value = match[1].trim();
        // Remove extra whitespace and special characters for certain fields
        if (fieldType === 'clientName') {
          value = value.replace(/\s+/g, ' ').replace(/[^\w\s&\.\-]/g, '');
        }
        if (fieldType === 'invoiceNo') {
          value = value.replace(/\s+/g, '').toUpperCase();
        }
        return value;
      }
    }

    return '';
  }

  /**
   * Clean and normalize amounts - reject phone numbers & handle all formats
   */
  cleanAmount(value) {
    if (!value) return '0.00';

    // Reject if it looks like a phone number (too many consecutive digits)
    if (/\d{10,}/.test(value.replace(/[\s\-\(\)]/g, ''))) {
      return '0.00';
    }

    // Handle split format like "528 / 15" (528 Dhs, 15 Fils = 528.15)
    const splitMatch = value.match(/(\d+)\s*\/\s*(\d+)/);
    if (splitMatch) {
      const dhs = splitMatch[1];
      const fils = splitMatch[2].padStart(2, '0');
      return `${dhs}.${fils}`;
    }

    // Remove currency symbols and text
    let cleaned = value
      .replace(/[^\d.,]/g, '')  // Keep only digits, comma, period
      .trim();

    if (!cleaned || cleaned === '' || cleaned === '0') {
      return '0.00';
    }

    // Handle different decimal separators
    if (cleaned.includes(',') && cleaned.includes('.')) {
      const lastComma = cleaned.lastIndexOf(',');
      const lastPeriod = cleaned.lastIndexOf('.');
      if (lastComma > lastPeriod) {
        cleaned = cleaned.replace(/\./g, '').replace(',', '.');
      } else {
        cleaned = cleaned.replace(/,/g, '');
      }
    } else if (cleaned.includes(',')) {
      const parts = cleaned.split(',');
      if (parts[parts.length - 1].length === 2) {
        cleaned = cleaned.replace(/,/g, '.').replace(/\./g, '');
        cleaned = cleaned.slice(0, -2) + '.' + cleaned.slice(-2);
      } else {
        cleaned = cleaned.replace(/,/g, '');
      }
    }

    // Extract the number
    const match = cleaned.match(/^(\d+(?:\.\d{1,2})?)/);
    if (match) {
      const num = parseFloat(match[1]);
      // Reject unrealistic amounts (> 1 million AED)
      if (num > 1000000) {
        return '0.00';
      }
      return num > 0 ? num.toFixed(2) : '0.00';
    }

    return '0.00';
  }

  /**
   * Extract line items from invoice
   */
  extractLineItems(text) {
    const items = [];
    
    // Try to match line items in table format
    const lines = text.split('\n');
    let inItemsSection = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Detect start of items section
      if (line.includes('DESCRIPTION') || line.includes('Description') || line.includes('Product')) {
        inItemsSection = true;
        continue;
      }

      // Detect end of items section
      if (inItemsSection && (line.includes('Total') || line.includes('Subtotal') || line === '')) {
        break;
      }

      // Try to parse item
      if (inItemsSection && line.length > 0) {
        const item = this.parseLineItem(line);
        if (item) {
          items.push(item);
        }
      }
    }

    return items;
  }

  /**
   * Parse individual line item
   */
  parseLineItem(line) {
    // Try different patterns
    const patterns = [
      // Pattern 1: Description Qty Price Amount
      /^(.+?)\s+(\d+)\s+([0-9,\.]+)\s+([0-9,\.]+)$/,
      // Pattern 2: With line number
      /^\d+\.\s+(.+?)\s+(\d+)\s+([0-9,\.]+)\s+([0-9,\.]+)$/,
      // Pattern 3: Simple format
      /^(.+?)\s+x?\s*(\d+)\s+([0-9,\.]+)$/,
    ];

    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match) {
        return {
          description: match[1]?.trim(),
          quantity: parseInt(match[2]),
          unitPrice: this.cleanAmount(match[3]),
          amount: match[4] ? this.cleanAmount(match[4]) : (parseFloat(match[2]) * parseFloat(this.cleanAmount(match[3]))).toFixed(2),
        };
      }
    }

    return null;
  }

  /**
   * Validate extracted data
   */
  validate(invoice) {
    const errors = [];
    const warnings = [];

    if (!invoice.clientName) {
      errors.push('Client name not found');
    }

    if (!invoice.invoiceNo) {
      warnings.push('Invoice number not found');
    }

    if (!invoice.trn) {
      warnings.push('TRN/VAT number not found');
    }

    if (parseFloat(invoice.totalAmount) <= 0) {
      errors.push('Invalid total amount');
    }

    // Check VAT calculation
    if (invoice.subtotal && invoice.vatAmount && invoice.totalAmount) {
      const calculated = (parseFloat(invoice.subtotal) * 0.05).toFixed(2);
      if (Math.abs(parseFloat(calculated) - parseFloat(invoice.vatAmount)) > 0.1) {
        warnings.push(`VAT mismatch: Expected ${calculated}, got ${invoice.vatAmount}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      confidence: this.calculateConfidence(invoice),
    };
  }

  /**
   * Calculate extraction confidence
   */
  calculateConfidence(invoice) {
    let score = 0;
    const totalChecks = 8;

    if (invoice.clientName) score++;
    if (invoice.invoiceNo) score++;
    if (invoice.trn) score++;
    if (invoice.invoiceDate) score++;
    if (invoice.subtotal && parseFloat(invoice.subtotal) > 0) score++;
    if (invoice.vatAmount && parseFloat(invoice.vatAmount) > 0) score++;
    if (invoice.totalAmount && parseFloat(invoice.totalAmount) > 0) score++;
    if (invoice.lineItems && invoice.lineItems.length > 0) score++;

    return ((score / totalChecks) * 100).toFixed(0);
  }

  /**
   * Format invoice for display
   */
  formatForDisplay(invoice) {
    return `
📄 Invoice Extracted

**Type:** ${this.invoiceTypes[invoice.invoiceType] || 'Unknown'}
**Client:** ${invoice.clientName}
**Invoice No:** ${invoice.invoiceNo}
**Date:** ${invoice.invoiceDate}
**Phone:** ${invoice.phoneNumber}

**Amount Details:**
Subtotal: ${invoice.currency} ${parseFloat(invoice.subtotal).toLocaleString()}
VAT (5%): ${invoice.currency} ${parseFloat(invoice.vatAmount).toLocaleString()}
**Total: ${invoice.currency} ${parseFloat(invoice.totalAmount).toLocaleString()}**

**Items:** ${invoice.lineItems.length} line item(s)
**Confidence:** ${this.calculateConfidence(invoice)}%

✅ Looks correct? Reply: "approved"
❌ Need changes? Reply: "client: name" or "amount: 500"
    `;
  }
}

module.exports = UAEInvoiceParser;

// Example usage
if (require.main === module) {
  const parser = new UAEInvoiceParser();

  const sampleText = `
ARMAAN MINIMART BRZ TAX INVOICE
Phone: 02 681 3926
Location: NEAR AL BATEEN AIRPORT
TRN: 010059728210003
Date: 16/05/2026
Invoice No: INV-2024-001

Product Details: Qty Rate Amount
LEAVES GREEN 1 6.00 6.00

TOTAL PRICE: 6.00 AED
  `;

  const result = parser.extract(sampleText);
  const validation = parser.validate(result);

  console.log('Extracted Invoice:', result);
  console.log('Validation:', validation);
  console.log('\nFormatted:\n', parser.formatForDisplay(result));
}