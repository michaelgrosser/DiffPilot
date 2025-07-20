# Support

## How to Get Help

If you're having trouble with DiffPilot, here are some ways to get help:

### Documentation

- Read the [README](README.md) for detailed usage instructions
- Check the [CHANGELOG](CHANGELOG.md) to see if your issue was recently addressed

### Report Issues

If you've found a bug or have a feature request:

1. **Check existing issues** first to avoid duplicates
2. **Create a new issue** on GitHub with:
   - Clear description of the problem
   - Steps to reproduce
   - Expected vs actual behavior
   - Your environment (VS Code version, OS)
   - Any relevant error messages

### Feature Requests

We welcome feature requests! Please:
- Explain the use case
- Describe how it would work
- Consider if it aligns with DiffPilot's goal of AI-friendly code reviews

### Contributing

Want to contribute? See our [Contributing Guidelines](README.md#contributing) for:
- Code style guidelines
- How to submit pull requests
- Development setup instructions

### Questions

For general questions about using DiffPilot:
- Check if it's covered in the README
- Look for similar questions in closed issues
- Open a new issue with the "question" label

### Response Time

This is an open-source project maintained in spare time. Response times may vary, but we'll do our best to address issues promptly.

## Troubleshooting

### Common Issues

**Extension not loading:**
- Ensure you're in a git repository
- Check VS Code version compatibility (requires 1.74.0+)
- Look for errors in the Output panel (View → Output → DiffPilot)

**Files not showing in panel:**
- Verify you have uncommitted changes
- Check that git is properly initialized
- Try manually refreshing with the refresh button

**Comments not saving:**
- Check write permissions for `.vscode/reviews/`
- Ensure the reviews directory exists
- Look for error notifications in VS Code

### Debug Mode

To enable detailed logging:
1. Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
2. Run "Developer: Toggle Developer Tools"
3. Check the Console tab for `[DiffPilot]` messages