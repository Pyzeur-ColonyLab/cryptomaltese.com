# Crypto-Sentinel Documentation

Welcome to the Crypto-Sentinel documentation. This directory contains comprehensive documentation for the enhanced fund flow tracking and analysis system.

## 📚 Documentation Index

### 🚀 Getting Started
- **[Main README](../README.md)** - Project overview, features, and quick start guide
- **[Requirements](requirements.md)** - Functional and non-functional requirements
- **[Technical Specifications](technical-specs.md)** - System architecture and API specifications
- **[Validation Criteria](validation-criteria.md)** - Testing and validation requirements

### 🏗️ Architecture & Design
- **[Architecture Design](architecture-design.md)** - High-level system design and component architecture
- **[API Documentation](API_DOCUMENTATION.md)** - Complete API reference with examples
- **[API Contracts](design/api-contracts.md)** - Detailed API endpoint specifications

### 🔧 Implementation
- **[Fund Flow Tracking Implementation](fund-flow-tracking-implementation.md)** - Current implementation status and features
- **[Enhanced Fund Flow Algorithm](enhanced-fund-flow-algorithm.md)** - Core algorithm specification and implementation
- **[Fund Flow Mapping Visualization](fund-flow-mapping-visualization.md)** - Sankey diagram implementation guide

### 🚀 Deployment & Operations
- **[Deployment Guide](DEPLOYMENT_GUIDE.md)** - Production deployment instructions
- **[Changelog](CHANGELOG.md)** - Complete development history and version changes

## 📖 Quick Navigation

### For New Users
1. Start with the **[Main README](../README.md)** for an overview
2. Read **[Requirements](requirements.md)** to understand the system goals
3. Follow the **[Deployment Guide](DEPLOYMENT_GUIDE.md)** to set up the system

### For Developers
1. Review **[Architecture Design](architecture-design.md)** for system structure
2. Study **[Enhanced Fund Flow Algorithm](enhanced-fund-flow-algorithm.md)** for algorithm details
3. Reference **[API Documentation](API_DOCUMENTATION.md)** for integration

### For System Administrators
1. Follow **[Deployment Guide](DEPLOYMENT_GUIDE.md)** for production setup
2. Review **[Technical Specifications](technical-specs.md)** for system requirements
3. Check **[Changelog](CHANGELOG.md)** for recent updates and fixes

## 🔍 Key Features Documentation

### Enhanced Fund Flow Tracking
- **Algorithm**: See [Enhanced Fund Flow Algorithm](enhanced-fund-flow-algorithm.md)
- **Implementation**: See [Fund Flow Tracking Implementation](fund-flow-tracking-implementation.md)
- **API Integration**: See [API Documentation](API_DOCUMENTATION.md)

### Visualization
- **Sankey Diagram**: See [Fund Flow Mapping Visualization](fund-flow-mapping-visualization.md)
- **Interactive Features**: See [Fund Flow Mapping Visualization](fund-flow-mapping-visualization.md)

### Analysis Management
- **Storage**: See [API Documentation](API_DOCUMENTATION.md#analysis-management)
- **History**: See [API Documentation](API_DOCUMENTATION.md#list-analyses)
- **Deterministic Results**: See [Enhanced Fund Flow Algorithm](enhanced-fund-flow-algorithm.md)

## 🛠️ Development Resources

### Code Structure
```
Crypto-Sentinel/
├── user-interface/          # Next.js frontend application
│   ├── src/app/            # Next.js app router
│   ├── src/services/       # API services and utilities
│   └── src/db/            # Database client
├── services/               # Backend services
│   ├── bitcoin.ts         # Bitcoin API integration
│   ├── etherscan.ts       # Etherscan API integration
│   ├── enhanced-fund-tracker.ts # Enhanced fund flow algorithm
│   └── types/             # TypeScript type definitions
├── db/                    # Database models and migrations
└── docs/                  # This documentation directory
```

### Key Files
- **Enhanced Fund Tracker**: `user-interface/src/services/enhanced-fund-tracker.ts`
- **Etherscan Integration**: `user-interface/src/services/etherscan-fixed.ts`
- **Analysis Component**: `user-interface/src/app/Analyse.tsx`
- **Database Schema**: `db/schema.sql`

## 📞 Support

For documentation issues or questions:
- Check the relevant documentation section above
- Review the [Changelog](CHANGELOG.md) for recent changes
- Contact the development team for additional assistance

## 🔄 Documentation Updates

This documentation is maintained alongside the codebase. When making changes:
1. Update the relevant documentation files
2. Update the [Changelog](CHANGELOG.md) with significant changes
3. Ensure all links and references remain valid
4. Test any code examples or commands

---

**Last Updated**: January 2025  
**Version**: 1.0.0  
**Status**: Production Ready - Enhanced Fund Flow Tracking Implemented 