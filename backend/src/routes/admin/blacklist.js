const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const FraudDetectionService = require('../../services/FraudDetectionService');
const { 
    observabilityMiddleware,
    createLogger,
    createSpan,
    finishSpan,
    addSpanTag,
    addSpanLog
} = require('../../middleware/observability');

const router = express.Router();
const fraudDetection = new FraudDetectionService();

// Aplicar observabilidade
router.use(observabilityMiddleware());

/**
 * Middleware para validar erros de validação
 */
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            error: 'Validation failed',
            details: errors.array(),
        });
    }
    next();
};

/**
 * Middleware para verificar permissões de admin
 * Em produção, implementar verificação real de roles/permissões
 */
const requireAdminAuth = (req, res, next) => {
    const logger = createLogger(req.correlationId, 'admin-auth');
    
    try {
        // Simulação de verificação de admin
        // Em produção, verificar JWT com role de admin
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                error: 'Admin authorization required',
                code: 'ADMIN_AUTH_REQUIRED'
            });
        }

        // Simulação - em produção, verificar token e role
        const token = authHeader.substring(7);
        if (token !== 'admin-token-demo') {
            return res.status(403).json({
                success: false,
                error: 'Insufficient permissions',
                code: 'INSUFFICIENT_PERMISSIONS'
            });
        }

        // Adicionar informações do admin ao request
        req.admin = {
            id: 'admin_demo',
            email: 'admin@capypay.com',
            role: 'SECURITY_ADMIN',
            permissions: ['BLACKLIST_MANAGE', 'FRAUD_INVESTIGATE', 'CASES_MANAGE']
        };

        logger.info('Admin access granted', {
            adminId: req.admin.id,
            permissions: req.admin.permissions,
            action: req.method + ' ' + req.originalUrl
        });

        next();
    } catch (error) {
        logger.error('Admin auth error', {
            error: error.message
        });

        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
};

/**
 * GET /api/admin/blacklist
 * Obter todas as entradas da blacklist com filtros
 */
router.get('/', [
    query('type')
        .optional()
        .isIn(['user', 'wallet', 'email', 'ip', 'phone', 'document', 'bank_account'])
        .withMessage('Invalid entity type'),
    query('severity')
        .optional()
        .isIn(['low', 'medium', 'high', 'critical'])
        .withMessage('Invalid severity level'),
    query('source')
        .optional()
        .isString()
        .withMessage('Source must be a string'),
    query('limit')
        .optional()
        .isInt({ min: 1, max: 1000 })
        .withMessage('Limit must be between 1 and 1000'),
    query('offset')
        .optional()
        .isInt({ min: 0 })
        .withMessage('Offset must be non-negative')
], requireAdminAuth, handleValidationErrors, async (req, res) => {
    const logger = createLogger(req.correlationId, 'admin-blacklist-list');
    const span = createSpan('admin_blacklist_list', req.span);
    
    try {
        const filters = {
            type: req.query.type,
            severity: req.query.severity,
            source: req.query.source,
            addedAfter: req.query.addedAfter,
            addedBefore: req.query.addedBefore
        };

        // Remover filtros vazios
        Object.keys(filters).forEach(key => {
            if (filters[key] === undefined || filters[key] === '') {
                delete filters[key];
            }
        });

        addSpanTag(span, 'filters.count', Object.keys(filters).length);
        addSpanLog(span, 'Retrieving blacklist entries', { filters });

        const blacklistService = fraudDetection.getBlacklistService();
        const result = await blacklistService.getBlacklistEntries(filters);

        if (!result.success) {
            finishSpan(span, 'error', new Error(result.error));
            return res.status(500).json({
                success: false,
                error: result.error
            });
        }

        // Aplicar paginação
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;
        const paginatedEntries = result.entries.slice(offset, offset + limit);

        logger.info('Blacklist entries retrieved', {
            adminId: req.admin.id,
            totalEntries: result.total,
            filteredEntries: result.entries.length,
            returnedEntries: paginatedEntries.length,
            filters
        });

        addSpanTag(span, 'entries.total', result.total);
        addSpanTag(span, 'entries.returned', paginatedEntries.length);
        finishSpan(span, 'success');

        res.json({
            success: true,
            data: {
                entries: paginatedEntries,
                pagination: {
                    total: result.total,
                    limit,
                    offset,
                    hasMore: (offset + limit) < result.total
                },
                filters,
                statistics: blacklistService.getStatistics()
            }
        });

    } catch (error) {
        logger.error('Error retrieving blacklist entries', {
            error: error.message,
            stack: error.stack,
            adminId: req.admin?.id
        });

        finishSpan(span, 'error', error);

        res.status(500).json({
            success: false,
            error: 'Internal server error',
            correlationId: req.correlationId
        });
    }
});

/**
 * POST /api/admin/blacklist
 * Adicionar nova entrada à blacklist
 */
router.post('/', [
    body('type')
        .isIn(['user', 'wallet', 'email', 'ip', 'phone', 'document', 'bank_account'])
        .withMessage('Invalid entity type'),
    body('value')
        .isString()
        .isLength({ min: 1, max: 500 })
        .withMessage('Value must be between 1 and 500 characters'),
    body('reason')
        .isString()
        .isLength({ min: 10, max: 1000 })
        .withMessage('Reason must be between 10 and 1000 characters'),
    body('severity')
        .optional()
        .isIn(['low', 'medium', 'high', 'critical'])
        .withMessage('Invalid severity level'),
    body('source')
        .optional()
        .isString()
        .withMessage('Source must be a string'),
    body('metadata')
        .optional()
        .isObject()
        .withMessage('Metadata must be an object')
], requireAdminAuth, handleValidationErrors, async (req, res) => {
    const logger = createLogger(req.correlationId, 'admin-blacklist-add');
    const span = createSpan('admin_blacklist_add', req.span);
    
    try {
        const { type, value, reason, severity = 'medium', source = 'manual', metadata = {} } = req.body;

        addSpanTag(span, 'blacklist.type', type);
        addSpanTag(span, 'blacklist.severity', severity);
        addSpanTag(span, 'blacklist.source', source);

        // Adicionar informações do admin aos metadados
        const enrichedMetadata = {
            ...metadata,
            addedBy: req.admin.id,
            addedByEmail: req.admin.email,
            addedVia: 'admin_interface',
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
        };

        addSpanLog(span, 'Adding entity to blacklist', { 
            type, 
            reason: reason.substring(0, 50) + '...' 
        });

        const blacklistService = fraudDetection.getBlacklistService();
        const result = await blacklistService.addToBlacklist(
            type,
            value,
            reason,
            severity,
            source,
            true, // logAudit
            enrichedMetadata
        );

        if (!result.success) {
            finishSpan(span, 'error', new Error(result.error));
            return res.status(400).json({
                success: false,
                error: result.error
            });
        }

        logger.info('Entity added to blacklist', {
            adminId: req.admin.id,
            type,
            value: blacklistService.maskSensitiveValue(type, value),
            reason: reason.substring(0, 100),
            severity,
            source,
            action: result.action
        });

        addSpanTag(span, 'result.action', result.action);
        finishSpan(span, 'success');

        res.status(201).json({
            success: true,
            message: `Entity ${result.action} in blacklist`,
            data: {
                entry: {
                    ...result.entry,
                    value: blacklistService.maskSensitiveValue(type, value) // Mascarar na resposta
                },
                action: result.action
            }
        });

    } catch (error) {
        logger.error('Error adding to blacklist', {
            error: error.message,
            stack: error.stack,
            adminId: req.admin?.id,
            type: req.body.type,
            value: req.body.value ? `***${req.body.value.slice(-4)}` : undefined
        });

        finishSpan(span, 'error', error);

        res.status(500).json({
            success: false,
            error: 'Internal server error',
            correlationId: req.correlationId
        });
    }
});

/**
 * DELETE /api/admin/blacklist/:type/:value
 * Remover entrada da blacklist
 */
router.delete('/:type/:value', [
    param('type')
        .isIn(['user', 'wallet', 'email', 'ip', 'phone', 'document', 'bank_account'])
        .withMessage('Invalid entity type'),
    param('value')
        .isString()
        .isLength({ min: 1, max: 500 })
        .withMessage('Value must be between 1 and 500 characters'),
    body('reason')
        .optional()
        .isString()
        .isLength({ min: 10, max: 500 })
        .withMessage('Reason must be between 10 and 500 characters')
], requireAdminAuth, handleValidationErrors, async (req, res) => {
    const logger = createLogger(req.correlationId, 'admin-blacklist-remove');
    const span = createSpan('admin_blacklist_remove', req.span);
    
    try {
        const { type, value } = req.params;
        const { reason = 'Removed by admin' } = req.body;

        addSpanTag(span, 'blacklist.type', type);
        addSpanLog(span, 'Removing entity from blacklist');

        const blacklistService = fraudDetection.getBlacklistService();
        const result = await blacklistService.removeFromBlacklist(
            type,
            value,
            reason,
            req.admin.id
        );

        if (!result.success) {
            finishSpan(span, 'error', new Error(result.error));
            return res.status(400).json({
                success: false,
                error: result.error
            });
        }

        logger.info('Entity removed from blacklist', {
            adminId: req.admin.id,
            type,
            value: blacklistService.maskSensitiveValue(type, value),
            reason,
            originalReason: result.removedEntry?.reason,
            originalSeverity: result.removedEntry?.severity
        });

        finishSpan(span, 'success');

        res.json({
            success: true,
            message: 'Entity removed from blacklist',
            data: {
                removedEntry: {
                    ...result.removedEntry,
                    value: blacklistService.maskSensitiveValue(type, value)
                },
                removalReason: reason,
                removedBy: req.admin.id,
                removedAt: new Date().toISOString()
            }
        });

    } catch (error) {
        logger.error('Error removing from blacklist', {
            error: error.message,
            adminId: req.admin?.id,
            type: req.params.type,
            value: req.params.value ? `***${req.params.value.slice(-4)}` : undefined
        });

        finishSpan(span, 'error', error);

        res.status(500).json({
            success: false,
            error: 'Internal server error',
            correlationId: req.correlationId
        });
    }
});

/**
 * POST /api/admin/blacklist/check
 * Verificar se entidades estão blacklistadas
 */
router.post('/check', [
    body('entities')
        .isArray({ min: 1, max: 100 })
        .withMessage('Entities must be an array with 1-100 items'),
    body('entities.*.type')
        .isIn(['user', 'wallet', 'email', 'ip', 'phone', 'document', 'bank_account'])
        .withMessage('Invalid entity type'),
    body('entities.*.value')
        .isString()
        .isLength({ min: 1, max: 500 })
        .withMessage('Value must be between 1 and 500 characters')
], requireAdminAuth, handleValidationErrors, async (req, res) => {
    const logger = createLogger(req.correlationId, 'admin-blacklist-check');
    const span = createSpan('admin_blacklist_check', req.span);
    
    try {
        const { entities } = req.body;

        addSpanTag(span, 'entities.count', entities.length);
        addSpanLog(span, 'Performing batch blacklist check');

        const blacklistService = fraudDetection.getBlacklistService();
        const result = await blacklistService.batchCheck(entities, req.correlationId);

        if (!result.success) {
            finishSpan(span, 'error', new Error(result.error));
            return res.status(500).json({
                success: false,
                error: result.error
            });
        }

        logger.info('Batch blacklist check completed', {
            adminId: req.admin.id,
            totalEntities: result.summary.total,
            blacklistedCount: result.summary.blacklisted,
            whitelistedCount: result.summary.whitelisted
        });

        addSpanTag(span, 'results.blacklisted', result.summary.blacklisted);
        addSpanTag(span, 'results.whitelisted', result.summary.whitelisted);
        finishSpan(span, 'success');

        res.json({
            success: true,
            data: {
                results: result.results.map(r => ({
                    ...r,
                    value: blacklistService.maskSensitiveValue(r.type, r.value)
                })),
                summary: result.summary,
                blacklistedEntities: result.blacklistedEntities.map(e => ({
                    ...e,
                    value: blacklistService.maskSensitiveValue(e.type, e.value)
                })),
                whitelistedEntities: result.whitelistedEntities.map(e => ({
                    ...e,
                    value: blacklistService.maskSensitiveValue(e.type, e.value)
                }))
            }
        });

    } catch (error) {
        logger.error('Error in batch blacklist check', {
            error: error.message,
            adminId: req.admin?.id,
            entitiesCount: req.body.entities?.length
        });

        finishSpan(span, 'error', error);

        res.status(500).json({
            success: false,
            error: 'Internal server error',
            correlationId: req.correlationId
        });
    }
});

/**
 * POST /api/admin/blacklist/import
 * Importar entradas em lote
 */
router.post('/import', [
    body('entries')
        .isArray({ min: 1, max: 10000 })
        .withMessage('Entries must be an array with 1-10000 items'),
    body('entries.*.type')
        .isIn(['user', 'wallet', 'email', 'ip', 'phone', 'document', 'bank_account'])
        .withMessage('Invalid entity type'),
    body('entries.*.value')
        .isString()
        .isLength({ min: 1, max: 500 })
        .withMessage('Value must be between 1 and 500 characters'),
    body('entries.*.reason')
        .isString()
        .isLength({ min: 10, max: 1000 })
        .withMessage('Reason must be between 10 and 1000 characters'),
    body('source')
        .optional()
        .isString()
        .withMessage('Source must be a string')
], requireAdminAuth, handleValidationErrors, async (req, res) => {
    const logger = createLogger(req.correlationId, 'admin-blacklist-import');
    const span = createSpan('admin_blacklist_import', req.span);
    
    try {
        const { entries, source = 'admin_bulk_import' } = req.body;

        addSpanTag(span, 'import.entries_count', entries.length);
        addSpanTag(span, 'import.source', source);
        addSpanLog(span, 'Starting bulk import');

        // Enriquecer entradas com metadados do admin
        const enrichedEntries = entries.map(entry => ({
            ...entry,
            metadata: {
                ...entry.metadata,
                importedBy: req.admin.id,
                importedByEmail: req.admin.email,
                importedAt: new Date().toISOString(),
                importSource: source,
                ipAddress: req.ip
            }
        }));

        const blacklistService = fraudDetection.getBlacklistService();
        const result = await blacklistService.bulkImport(enrichedEntries, source);

        logger.info('Bulk import completed', {
            adminId: req.admin.id,
            source,
            totalEntries: entries.length,
            imported: result.imported,
            updated: result.updated,
            skipped: result.skipped,
            errors: result.errors.length
        });

        addSpanTag(span, 'import.imported', result.imported);
        addSpanTag(span, 'import.updated', result.updated);
        addSpanTag(span, 'import.errors', result.errors.length);
        finishSpan(span, result.success ? 'success' : 'partial_success');

        const statusCode = result.success ? 200 : 207; // 207 Multi-Status for partial success

        res.status(statusCode).json({
            success: result.success,
            message: `Bulk import completed: ${result.imported} imported, ${result.updated} updated, ${result.skipped} skipped`,
            data: {
                imported: result.imported,
                updated: result.updated,
                skipped: result.skipped,
                errors: result.errors.length,
                errorDetails: result.errors.slice(0, 10), // Primeiros 10 erros
                source,
                importedBy: req.admin.id,
                importedAt: new Date().toISOString()
            }
        });

    } catch (error) {
        logger.error('Error in bulk import', {
            error: error.message,
            adminId: req.admin?.id,
            entriesCount: req.body.entries?.length
        });

        finishSpan(span, 'error', error);

        res.status(500).json({
            success: false,
            error: 'Internal server error',
            correlationId: req.correlationId
        });
    }
});

/**
 * GET /api/admin/blacklist/export
 * Exportar blacklist
 */
router.get('/export', [
    query('format')
        .optional()
        .isIn(['json', 'csv'])
        .withMessage('Format must be json or csv'),
    query('type')
        .optional()
        .isIn(['user', 'wallet', 'email', 'ip', 'phone', 'document', 'bank_account'])
        .withMessage('Invalid entity type'),
    query('severity')
        .optional()
        .isIn(['low', 'medium', 'high', 'critical'])
        .withMessage('Invalid severity level')
], requireAdminAuth, handleValidationErrors, async (req, res) => {
    const logger = createLogger(req.correlationId, 'admin-blacklist-export');
    const span = createSpan('admin_blacklist_export', req.span);
    
    try {
        const format = req.query.format || 'json';
        const filters = {
            type: req.query.type,
            severity: req.query.severity,
            source: req.query.source
        };

        // Remover filtros vazios
        Object.keys(filters).forEach(key => {
            if (!filters[key]) delete filters[key];
        });

        addSpanTag(span, 'export.format', format);
        addSpanTag(span, 'export.filters', Object.keys(filters).length);
        addSpanLog(span, 'Exporting blacklist data');

        const blacklistService = fraudDetection.getBlacklistService();
        const result = await blacklistService.exportBlacklist(filters);

        if (!result.success) {
            finishSpan(span, 'error', new Error(result.error));
            return res.status(500).json({
                success: false,
                error: result.error
            });
        }

        logger.info('Blacklist exported', {
            adminId: req.admin.id,
            format,
            entriesCount: result.data.entries.length,
            filters
        });

        addSpanTag(span, 'export.entries_count', result.data.entries.length);
        finishSpan(span, 'success');

        if (format === 'csv') {
            // Converter para CSV
            const csvHeader = 'Type,Value,Reason,Severity,Source,Added At,Added By\n';
            const csvRows = result.data.entries.map(entry => 
                `"${entry.type}","${entry.value}","${entry.reason}","${entry.severity}","${entry.source}","${entry.addedAt}","${entry.addedBy}"`
            ).join('\n');
            
            const csvContent = csvHeader + csvRows;

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="blacklist_export_${Date.now()}.csv"`);
            res.send(csvContent);
        } else {
            // JSON format
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename="blacklist_export_${Date.now()}.json"`);
            res.json({
                success: true,
                data: result.data,
                exportedBy: req.admin.id,
                exportedAt: new Date().toISOString()
            });
        }

    } catch (error) {
        logger.error('Error exporting blacklist', {
            error: error.message,
            adminId: req.admin?.id
        });

        finishSpan(span, 'error', error);

        res.status(500).json({
            success: false,
            error: 'Internal server error',
            correlationId: req.correlationId
        });
    }
});

/**
 * GET /api/admin/blacklist/statistics
 * Obter estatísticas da blacklist
 */
router.get('/statistics', requireAdminAuth, async (req, res) => {
    const logger = createLogger(req.correlationId, 'admin-blacklist-stats');
    
    try {
        const blacklistService = fraudDetection.getBlacklistService();
        const stats = blacklistService.getStatistics();

        logger.info('Blacklist statistics retrieved', {
            adminId: req.admin.id,
            totalEntries: stats.total
        });

        res.json({
            success: true,
            data: {
                statistics: stats,
                retrievedBy: req.admin.id,
                retrievedAt: new Date().toISOString()
            }
        });

    } catch (error) {
        logger.error('Error retrieving blacklist statistics', {
            error: error.message,
            adminId: req.admin?.id
        });

        res.status(500).json({
            success: false,
            error: 'Internal server error',
            correlationId: req.correlationId
        });
    }
});

/**
 * GET /api/admin/blacklist/audit-logs
 * Obter logs de auditoria da blacklist
 */
router.get('/audit-logs', [
    query('action')
        .optional()
        .isString()
        .withMessage('Action must be a string'),
    query('limit')
        .optional()
        .isInt({ min: 1, max: 1000 })
        .withMessage('Limit must be between 1 and 1000'),
    query('after')
        .optional()
        .isISO8601()
        .withMessage('After must be a valid ISO date'),
    query('before')
        .optional()
        .isISO8601()
        .withMessage('Before must be a valid ISO date')
], requireAdminAuth, handleValidationErrors, async (req, res) => {
    const logger = createLogger(req.correlationId, 'admin-audit-logs');
    
    try {
        const filters = {
            action: req.query.action,
            limit: parseInt(req.query.limit) || 100,
            after: req.query.after,
            before: req.query.before
        };

        const blacklistService = fraudDetection.getBlacklistService();
        const result = blacklistService.getAuditLogs(filters);

        logger.info('Audit logs retrieved', {
            adminId: req.admin.id,
            logsCount: result.logs.length,
            totalLogs: result.total,
            filters
        });

        res.json({
            success: true,
            data: {
                logs: result.logs,
                total: result.total,
                filters,
                retrievedBy: req.admin.id,
                retrievedAt: new Date().toISOString()
            }
        });

    } catch (error) {
        logger.error('Error retrieving audit logs', {
            error: error.message,
            adminId: req.admin?.id
        });

        res.status(500).json({
            success: false,
            error: 'Internal server error',
            correlationId: req.correlationId
        });
    }
});

module.exports = router; 