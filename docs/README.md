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
- **[Fund Tracker Enhancement Specification](fund_tracker_enhancement_spec.md)** - Core algorithm specification
- **[Fund Flow Tracking Fixes](fund-flow-tracking-fixes.md)** - Critical fixes and optimizations
- **[Fund Flow Mapping Diagram](fund-flow-mapping-diagram.md)** - Sankey diagram implementation guide

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
2. Study **[Fund Tracker Enhancement Specification](fund_tracker_enhancement_spec.md)** for algorithm details
3. Reference **[API Documentation](API_DOCUMENTATION.md)** for integration

### For System Administrators
1. Follow **[Deployment Guide](DEPLOYMENT_GUIDE.md)** for production setup
2. Review **[Technical Specifications](technical-specs.md)** for system requirements
3. Check **[Changelog](CHANGELOG.md)** for recent updates and fixes

## 🔍 Key Features Documentation

### Enhanced Fund Flow Tracking
- **Algorithm**: See [Fund Tracker Enhancement Specification](fund_tracker_enhancement_spec.md)
- **Optimizations**: See [Fund Flow Tracking Fixes](fund-flow-tracking-fixes.md)
- **API Integration**: See [API Documentation](API_DOCUMENTATION.md)

### Visualization
- **Sankey Diagram**: See [Fund Flow Mapping Diagram](fund-flow-mapping-diagram.md)
- **Interactive Features**: See [Fund Flow Mapping Diagram](fund-flow-mapping-diagram.md)

### Analysis Management
- **Storage**: See [API Documentation](API_DOCUMENTATION.md#analysis-management)
- **History**: See [API Documentation](API_DOCUMENTATION.md#list-analyses)
- **Deterministic Results**: See [Fund Flow Tracking Fixes](fund-flow-tracking-fixes.md)

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

**Last Updated**: August 2025  
**Version**: 1.0.0  
**Status**: Production Ready 