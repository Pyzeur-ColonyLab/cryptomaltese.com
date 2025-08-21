/**
 * Unit tests for validation utilities
 */

const { Validator } = require('../../client/js/validation')

describe('Validator', () => {
    describe('validateEthereumAddress', () => {
        it('should accept valid Ethereum addresses', () => {
            const validAddresses = [
                '0x1234567890123456789012345678901234567890',
                '0xabcdefABCDEF1234567890123456789012345678',
                '0x0000000000000000000000000000000000000000'
            ]

            validAddresses.forEach(address => {
                const result = Validator.validateEthereumAddress(address)
                expect(result.isValid).toBe(true)
                expect(result.message).toBe('')
            })
        })

        it('should reject invalid Ethereum addresses', () => {
            const invalidAddresses = [
                '', // empty
                '0x123', // too short
                '0x12345678901234567890123456789012345678901', // too long
                '1234567890123456789012345678901234567890', // missing 0x
                '0xGHIJ567890123456789012345678901234567890', // invalid characters
                '0x', // only prefix
                null,
                undefined
            ]

            invalidAddresses.forEach(address => {
                const result = Validator.validateEthereumAddress(address)
                expect(result.isValid).toBe(false)
                expect(result.message).toBeTruthy()
            })
        })

        it('should handle whitespace correctly', () => {
            const addressWithSpaces = '  0x1234567890123456789012345678901234567890  '
            const result = Validator.validateEthereumAddress(addressWithSpaces)
            expect(result.isValid).toBe(true)
        })
    })

    describe('validateTransactionHash', () => {
        it('should accept valid transaction hashes', () => {
            const validHashes = [
                '0x1234567890123456789012345678901234567890123456789012345678901234',
                '0xabcdefABCDEF1234567890123456789012345678901234567890123456789012',
                '0x0000000000000000000000000000000000000000000000000000000000000000'
            ]

            validHashes.forEach(hash => {
                const result = Validator.validateTransactionHash(hash)
                expect(result.isValid).toBe(true)
                expect(result.message).toBe('')
            })
        })

        it('should reject invalid transaction hashes', () => {
            const invalidHashes = [
                '', // empty
                '0x123', // too short
                '0x12345678901234567890123456789012345678901234567890123456789012345', // too long
                '1234567890123456789012345678901234567890123456789012345678901234', // missing 0x
                '0xGHIJ567890123456789012345678901234567890123456789012345678901234', // invalid characters
                null,
                undefined
            ]

            invalidHashes.forEach(hash => {
                const result = Validator.validateTransactionHash(hash)
                expect(result.isValid).toBe(false)
                expect(result.message).toBeTruthy()
            })
        })
    })

    describe('validateDescription', () => {
        it('should accept valid descriptions', () => {
            const validDescriptions = [
                'This is a valid description that is long enough',
                'Wallet was compromised through a phishing attack. The attacker gained access to my private keys.',
                'A'.repeat(1000) // exactly 1000 characters
            ]

            validDescriptions.forEach(description => {
                const result = Validator.validateDescription(description)
                expect(result.isValid).toBe(true)
                expect(result.message).toBe('')
            })
        })

        it('should reject descriptions that are too short', () => {
            const shortDescriptions = [
                '',
                'short',
                'too short'
            ]

            shortDescriptions.forEach(description => {
                const result = Validator.validateDescription(description)
                expect(result.isValid).toBe(false)
                expect(result.message).toContain('at least 10 characters')
            })
        })

        it('should reject descriptions that are too long', () => {
            const longDescription = 'A'.repeat(1001) // over 1000 characters
            const result = Validator.validateDescription(longDescription)
            expect(result.isValid).toBe(false)
            expect(result.message).toContain('cannot exceed 1000 characters')
        })

        it('should handle whitespace correctly', () => {
            const descriptionWithSpaces = '  This is a valid description with spaces  '
            const result = Validator.validateDescription(descriptionWithSpaces)
            expect(result.isValid).toBe(true)
        })
    })

    describe('validateForm', () => {
        it('should validate complete form data successfully', () => {
            const validFormData = {
                walletAddress: '0x1234567890123456789012345678901234567890',
                transactionHash: '0x1234567890123456789012345678901234567890123456789012345678901234',
                description: 'This is a valid incident description that meets all requirements.'
            }

            const result = Validator.validateForm(validFormData)
            expect(result.isValid).toBe(true)
            expect(Object.keys(result.errors)).toHaveLength(0)
        })

        it('should return multiple validation errors', () => {
            const invalidFormData = {
                walletAddress: 'invalid',
                transactionHash: 'invalid',
                description: 'short'
            }

            const result = Validator.validateForm(invalidFormData)
            expect(result.isValid).toBe(false)
            expect(result.errors.walletAddress).toBeTruthy()
            expect(result.errors.transactionHash).toBeTruthy()
            expect(result.errors.description).toBeTruthy()
        })

        it('should handle empty form data', () => {
            const emptyFormData = {
                walletAddress: '',
                transactionHash: '',
                description: ''
            }

            const result = Validator.validateForm(emptyFormData)
            expect(result.isValid).toBe(false)
            expect(Object.keys(result.errors)).toHaveLength(3)
        })
    })
})
