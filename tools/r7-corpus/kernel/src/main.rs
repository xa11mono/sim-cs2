use std::io::{self, Read, Write};

fn main() -> io::Result<()> {
    let mut input = io::stdin().lock();
    let mut output = io::stdout().lock();
    let mut op = [0];
    while input.read(&mut op)? == 1 {
        let mut size = [0; 2];
        input.read_exact(&mut size)?;
        let words = u16::from_le_bytes(size) as usize;
        let mut values = Vec::with_capacity(words);
        for _ in 0..words {
            let mut word = [0; 8];
            input.read_exact(&mut word)?;
            values.push(f64::from_le_bytes(word));
        }
        let mut result = [0.0; 4];
        let words = sim_r7_parity::compute(op[0], &values, &mut result)
            .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidData, "invalid parity request"))?;
        output.write_all(&[words as u8])?;
        for value in &result[..words] {
            output.write_all(&value.to_le_bytes())?;
        }
    }
    Ok(())
}
