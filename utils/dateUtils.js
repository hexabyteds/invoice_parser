function formatDate(date) {

    if (!date) return null;

    // Already MySQL format
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return date;
    }

    // DD-MM-YYYY
    if (/^\d{2}-\d{2}-\d{4}$/.test(date)) {
        const [day, month, year] = date.split("-");
        return `${year}-${month}-${day}`;
    }

    // DD/MM/YYYY
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(date)) {
        const [day, month, year] = date.split("/");
        return `${year}-${month}-${day}`;
    }

    // Let JS try
    const d = new Date(date);

    if (!isNaN(d)) {
        return d.toISOString().split("T")[0];
    }

    return null;
}

module.exports = {
    formatDate
};