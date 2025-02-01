import fs from 'fs-extra'

export const checkIfUploadsFolderExists = async (foldername: string) => {
    try {
        await fs.promises.stat(foldername)
    } catch {
        console.error("Папка не найдена, создана новая...")
        await fs.promises.mkdir(foldername)
    }
}