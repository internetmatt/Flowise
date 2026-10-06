import logo from '@/assets/images/flowise_white.svg'
import logoDark from '@/assets/images/flowise_dark.svg'

import { useSelector } from 'react-redux'
import { resolveBrandLogoUrl, resolveBrandProductName } from '@/utils/brandConfig.mjs'

// ==============================|| LOGO ||============================== //

const Logo = () => {
    const customization = useSelector((state) => state.customization)
    const productName = resolveBrandProductName('Flowise')
    const logoUrl = resolveBrandLogoUrl(logo, logoDark, customization.isDarkMode)

    return (
        <div style={{ alignItems: 'center', display: 'flex', flexDirection: 'row', marginLeft: '10px' }}>
            <img style={{ objectFit: 'contain', height: 'auto', width: 150 }} src={logoUrl} alt={productName} />
        </div>
    )
}

export default Logo
