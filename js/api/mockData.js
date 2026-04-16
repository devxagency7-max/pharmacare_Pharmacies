/**
 * Mock Data for Pharmacy Dashboard
 */
const mockData = {
    stats: {
        todayOrders: 142,
        pendingOrders: 28,
        revenue: "$4,850",
        lowStock: 12
    },
    orders: [
        { id: "#ORD-001", patient: "Alice Cooper", prescription: "#RX-552", total: "$120.00", status: "Delivered", date: "2026-03-10" },
        { id: "#ORD-002", patient: "Bob Marley", prescription: "#RX-881", total: "$45.50", status: "Preparing", date: "2026-03-11" },
        { id: "#ORD-003", patient: "Charlie Brown", prescription: "None", total: "$30.00", status: "Pending", date: "2026-03-11" },
        { id: "#ORD-004", patient: "Diana Ross", prescription: "#RX-902", total: "$210.00", status: "Ready", date: "2026-03-11" }
    ],
    prescriptions: [
        { id: "RX-1021", patient: "John Doe", image: "https://via.placeholder.com/40", status: "Pending", date: "2026-03-11" },
        { id: "RX-1022", patient: "Jane Smith", image: "https://via.placeholder.com/40", status: "Approved", date: "2026-03-10" }
    ],
    inventory: [
        { name: "Paracetamol 500mg", stock: 450, price: "$5.00", expiry: "2027-05-12", status: "In Stock" },
        { name: "Amoxicillin 250mg", stock: 20, price: "$12.50", expiry: "2026-12-01", status: "Low Stock" },
        { name: "Ibuprofen 400mg", stock: 0, price: "$8.00", expiry: "2028-01-15", status: "Out of Stock" }
    ],
    notifications: [
        { title: "New Order", message: "Order #ORD-003 has been placed.", time: "5m ago" },
        { title: "Prescription Update", message: "Patient John Doe uploaded a new prescription.", time: "1h ago" },
        { title: "New Message", message: "You have a new message from Sarah.", time: "2h ago" }
    ]
};

window.mockData = mockData;
