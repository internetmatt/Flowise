/**
 * OSS / Projecto loopback has no login wall (see /auth/resolve), but internal
 * APIs still go through verifyToken. Ideas WebUI's canvas island therefore
 * 401s POST /api/v1/chatflows with "Invalid or Missing token".
 *
 * When the platform is open source and the TCP peer is loopback, attach the
 * single-tenant default workspace so create/list work without a JWT cookie.
 * Non-loopback clients and Cloud/Enterprise still require a real session.
 */
import { Request } from 'express'
import { Platform } from '../../Interface'
import { getRunningExpressApp } from '../../utils/getRunningExpressApp'
import { Organization } from '../database/entities/organization.entity'
import { GeneralRole, Role } from '../database/entities/role.entity'
import { User } from '../database/entities/user.entity'
import { Workspace, WorkspaceName } from '../database/entities/workspace.entity'
import { LoggedInUser } from '../Interface.Enterprise'

export function isLoopbackAddress(address: string | undefined): boolean {
    if (!address) return false
    const host = address.replace(/^::ffff:/i, '').replace(/^\[|\]$/g, '')
    return host === '127.0.0.1' || host === '::1' || host === 'localhost' || host === '0:0:0:0:0:0:0:1'
}

export function isLoopbackRequest(req: Pick<Request, 'ip'> & { socket?: { remoteAddress?: string } }): boolean {
    if (process.env.FLOWISE_DESKTOP_EMBEDDED === 'true') return true
    return isLoopbackAddress(req.ip) || isLoopbackAddress(req.socket?.remoteAddress)
}

function parseRolePermissions(raw: string | undefined): string[] {
    if (!raw) return []
    try {
        const parsed: unknown = JSON.parse(raw)
        return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
    } catch {
        return []
    }
}

export async function resolveOssLoopbackUser(req: Request): Promise<LoggedInUser | null> {
    const app = getRunningExpressApp()
    if (app.identityManager.getPlatformType() !== Platform.OPEN_SOURCE) return null
    if (!isLoopbackRequest(req)) return null

    const workspaceRepo = app.AppDataSource.getRepository(Workspace)
    const preferredId = process.env.FLOWISE_DEFAULT_WORKSPACE_ID
    let workspace = preferredId ? await workspaceRepo.findOne({ where: { id: preferredId } }) : null
    if (!workspace) {
        workspace = await workspaceRepo.findOne({ where: { name: WorkspaceName.DEFAULT_WORKSPACE } })
    }
    if (!workspace) {
        const [first] = await workspaceRepo.find({ take: 1, order: { createdDate: 'ASC' } })
        workspace = first ?? null
    }
    if (!workspace?.id || !workspace.organizationId) return null

    const organization = await app.AppDataSource.getRepository(Organization).findOne({
        where: { id: workspace.organizationId }
    })
    if (!organization) return null

    const roleRepo = app.AppDataSource.getRepository(Role)
    const ownerRole =
        (await roleRepo.findOne({ where: { name: GeneralRole.OWNER, organizationId: organization.id } })) ||
        (await roleRepo.findOne({ where: { name: GeneralRole.OWNER } }))

    const user = workspace.createdBy ? await app.AppDataSource.getRepository(User).findOne({ where: { id: workspace.createdBy } }) : null

    return {
        id: user?.id || workspace.createdBy || organization.createdBy || 'oss-loopback',
        email: user?.email || 'oss@localhost',
        name: user?.name || 'OpenIdeas',
        roleId: ownerRole?.id || 'owner',
        activeOrganizationId: organization.id,
        activeOrganizationSubscriptionId: organization.subscriptionId || '',
        activeOrganizationCustomerId: organization.customerId || '',
        activeOrganizationProductId: '',
        isOrganizationAdmin: true,
        activeWorkspaceId: workspace.id,
        activeWorkspace: workspace.name,
        assignedWorkspaces: [
            {
                id: workspace.id,
                name: workspace.name,
                role: GeneralRole.OWNER,
                organizationId: organization.id
            }
        ],
        permissions: parseRolePermissions(ownerRole?.permissions)
    }
}
