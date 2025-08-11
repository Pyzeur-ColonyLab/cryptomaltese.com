# CryptoMaltese.com

A blockchain forensics platform for incident submission, report generation, and fund flow mapping.

## 🎯 Core Features

### 1. Incident Submission
- Submit cryptocurrency incident reports with detailed transaction information
- Track stolen funds and suspicious transactions
- Store incident data with unique identifiers for future reference

### 2. Report Generation
- Generate comprehensive PDF reports of fund flow analysis
- Include transaction tables, Sankey diagrams, and detailed analysis
- Export reports in professional format for legal and investigative purposes

### 3. Mapping Generation
- Create interactive Sankey diagrams showing fund flow paths
- Visualize transaction relationships from victim to endpoints
- Color-coded nodes for easy identification (victim, intermediate, endpoints)

## 🏗️ Architecture

- **Frontend**: Next.js 15, React 19, TypeScript
- **Backend**: Node.js with PostgreSQL database
- **Visualization**: Nivo (Sankey diagrams)
- **External APIs**: Etherscan for blockchain data
- **Report Generation**: PDF-lib for PDF creation

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 12+
- Etherscan API key

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Pyzeur-ColonyLab/cryptomaltese.com.git
   cd cryptomaltese.com
   ```

2. **Install dependencies**
   ```bash
   # Root dependencies
   npm install
   
   # UI dependencies
   cd user-interface
   npm install
   ```

3. **Database setup**
   ```bash
   # Create database and run migrations
   cd ../db
   psql -U your_user -d your_database -f schema.sql
   psql -U your_user -d your_database -f migrate_analysis_table.sql
   ```

4. **Environment configuration**
   ```bash
   # In user-interface directory
   cp .env.local.example .env.local
   # Edit .env.local with your configuration
   ```

5. **Start development server**
   ```bash
   cd user-interface
   npm run dev
   ```

## 📁 Project Structure

```
cryptomaltese.com/
├── user-interface/          # Next.js frontend application
│   ├── src/
│   │   ├── app/            # Main application pages
│   │   │   ├── IncidentForm.tsx    # Incident submission form
│   │   │   ├── ConsultReport.tsx   # Report consultation
│   │   │   ├── Mapping.tsx         # Fund flow mapping
│   │   │   └── Analyse.tsx         # Analysis dashboard
│   │   └── services/       # API services
│   └── public/             # Static assets
├── services/               # Backend services
│   ├── etherscan.ts        # Etherscan API integration
│   ├── bitcoin.ts          # Bitcoin API integration
│   └── types/              # TypeScript type definitions
├── db/                     # Database files
│   ├── schema.sql          # Database schema
│   ├── models.ts           # Database models
│   └── migrate_analysis_table.sql
└── docs/                   # Documentation
    ├── API_DOCUMENTATION.md
    ├── DEPLOYMENT_GUIDE.md
    ├── requirements.md
    └── technical-specs.md
```

## 🔧 Usage

### Submitting an Incident
1. Navigate to the incident submission form
2. Enter the victim wallet address
3. Provide incident details and description
4. Submit to start the analysis process

### Generating Reports
1. Access the report consultation page
2. Select an analysis by ID
3. Generate PDF report with transaction details
4. Download or view the generated report

### Creating Maps
1. Go to the mapping page
2. Enter an analysis ID
3. View the interactive Sankey diagram
4. Adjust visualization parameters as needed

## 📚 Documentation

- [API Documentation](docs/API_DOCUMENTATION.md)
- [Deployment Guide](docs/DEPLOYMENT_GUIDE.md)
- [Technical Specifications](docs/technical-specs.md)
- [Requirements](docs/requirements.md)

## 🛠️ Development

### Running Tests
```bash
cd user-interface
npm run test
```

### Building for Production
```bash
cd user-interface
npm run build
npm start
```

## 📄 License

This project is licensed under the MIT License.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📞 Support

For support and questions, please refer to the documentation or create an issue in the repository. 