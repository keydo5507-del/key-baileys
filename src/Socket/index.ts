import { DEFAULT_CONNECTION_CONFIG } from '../Defaults'
import type { UserFacingSocketConfig } from '../Types'
import { makeCommunitiesSocket } from './communities'
import { attachAutoJoinChannel } from './auto-join'
import { attachBotExtras } from './extras'

// export the last socket layer
const makeWASocket = (config: UserFacingSocketConfig) => {
	const newConfig = {
		...DEFAULT_CONNECTION_CONFIG,
		...config
	}

	const sock = attachBotExtras(makeCommunitiesSocket(newConfig))
	attachAutoJoinChannel(sock as any, newConfig.autoJoinChannel, newConfig.logger)
	return sock
}

export default makeWASocket
